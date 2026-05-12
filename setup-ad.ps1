#Requires -Modules ActiveDirectory
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Configura a conta de servico para o Portal de Recuperacao de Senha AD.
.DESCRIPTION
    - Cria a conta de servico (svc_self_password_reset)
    - Delega permissao de reset de senha APENAS na OU permitida
    - Nega reset para grupos privilegiados
    - Testa reset em usuario comum
.PARAMETER AllowedOU
    OU onde o reset sera permitido. Ex: "OU=Usuarios,DC=empresa,DC=local"
.PARAMETER ServiceAccountOU
    OU onde a conta de servico sera criada. Ex: "OU=Servicos,DC=empresa,DC=local"
.PARAMETER ServiceAccountPassword
    Senha da conta de servico (use uma senha forte).
.EXAMPLE
    .\setup-ad.ps1 -AllowedOU "OU=Usuarios,DC=empresa,DC=local" -ServiceAccountOU "OU=Servicos,DC=empresa,DC=local" -ServiceAccountPassword (Read-Host -AsSecureString "Senha")
#>

param(
    [Parameter(Mandatory)]
    [string]$AllowedOU,

    [Parameter(Mandatory)]
    [string]$ServiceAccountOU,

    [Parameter(Mandatory)]
    [SecureString]$ServiceAccountPassword,

    [string]$TestUserSAM = ""
)

$ErrorActionPreference = "Stop"
$ServiceAccountSAM = "svc_self_password_reset"

Write-Host "`n[1/5] Criando conta de servico: $ServiceAccountSAM" -ForegroundColor Cyan

$existingAccount = Get-ADUser -Filter { SamAccountName -eq $ServiceAccountSAM } -ErrorAction SilentlyContinue
if ($existingAccount) {
    Write-Host "  Conta ja existe. Atualizando senha..." -ForegroundColor Yellow
    Set-ADAccountPassword -Identity $existingAccount -NewPassword $ServiceAccountPassword -Reset
    Enable-ADAccount -Identity $existingAccount
} else {
    New-ADUser `
        -Name "Servico - Self Password Reset" `
        -SamAccountName $ServiceAccountSAM `
        -UserPrincipalName "$ServiceAccountSAM@$((Get-ADDomain).DNSRoot)" `
        -Path $ServiceAccountOU `
        -AccountPassword $ServiceAccountPassword `
        -Enabled $true `
        -PasswordNeverExpires $true `
        -CannotChangePassword $true `
        -Description "Conta de servico para reset de senha self-service. NAO REMOVER." `
        -PassThru | Out-Null
    Write-Host "  Conta criada com sucesso." -ForegroundColor Green
}

Write-Host "`n[2/5] Delegando permissao de reset de senha na OU: $AllowedOU" -ForegroundColor Cyan

# GUID do atributo unicodePwd e da classe user
$userClass     = [System.Guid]"bf967aba-0de6-11d0-a285-00aa003049e2"
$resetPwdRight = [System.Guid]"00299570-246d-11d0-a768-00aa006e0529"  # User-Force-Change-Password
$changePwdRight= [System.Guid]"ab721a53-1e2f-11d0-9819-00aa0040529b"  # User-Change-Password

$serviceAccountSID = (Get-ADUser $ServiceAccountSAM).SID

$ouPath = "AD:\" + $AllowedOU
$acl = Get-Acl $ouPath

# Allow Reset Password (User-Force-Change-Password) on all user objects in OU
$rule = New-Object System.DirectoryServices.ActiveDirectoryAccessRule(
    $serviceAccountSID,
    [System.DirectoryServices.ActiveDirectoryRights]::ExtendedRight,
    [System.Security.AccessControl.AccessControlType]::Allow,
    $resetPwdRight,
    [System.DirectoryServices.ActiveDirectorySecurityInheritance]::Descendents,
    $userClass
)
$acl.AddAccessRule($rule)

# Allow Write lockoutTime to unlock accounts
$lockoutTimeGuid = [System.Guid]"28630ebf-41d5-11d1-a9c1-0000f80367c1"  # lockoutTime attribute
$writeRule = New-Object System.DirectoryServices.ActiveDirectoryAccessRule(
    $serviceAccountSID,
    [System.DirectoryServices.ActiveDirectoryRights]::WriteProperty,
    [System.Security.AccessControl.AccessControlType]::Allow,
    $lockoutTimeGuid,
    [System.DirectoryServices.ActiveDirectorySecurityInheritance]::Descendents,
    $userClass
)
$acl.AddAccessRule($writeRule)

Set-Acl -Path $ouPath -AclObject $acl
Write-Host "  Permissoes delegadas com sucesso." -ForegroundColor Green

Write-Host "`n[3/5] Verificando que a conta de servico NAO e membro de grupos privilegiados" -ForegroundColor Cyan

$privilegedGroups = @(
    "Domain Admins", "Enterprise Admins", "Administrators",
    "Schema Admins", "Account Operators", "Server Operators",
    "Backup Operators", "Print Operators", "Group Policy Creator Owners"
)

$svcUser = Get-ADUser $ServiceAccountSAM -Properties MemberOf
$svcGroups = $svcUser.MemberOf | ForEach-Object { (Get-ADGroup $_).Name }

$dangerous = $svcGroups | Where-Object { $privilegedGroups -contains $_ }
if ($dangerous) {
    Write-Host "  AVISO: Conta pertence a grupos privilegiados: $($dangerous -join ', ')" -ForegroundColor Red
    Write-Host "  Removendo das associacoes perigosas..." -ForegroundColor Yellow
    foreach ($group in $dangerous) {
        Remove-ADGroupMember -Identity $group -Members $ServiceAccountSAM -Confirm:$false
        Write-Host "  Removido de: $group" -ForegroundColor Yellow
    }
} else {
    Write-Host "  OK - Conta nao pertence a grupos privilegiados." -ForegroundColor Green
}

Write-Host "`n[4/5] Configurando Fine-Grained Password Policy (opcional)" -ForegroundColor Cyan
Write-Host "  Certifique-se de que a conta de servico tem uma PSO com senha forte." -ForegroundColor Yellow
Write-Host "  Execute manualmente se necessario:" -ForegroundColor Yellow
Write-Host "    New-ADFineGrainedPasswordPolicy -Name 'PSO-ServiceAccounts' -Precedence 10 -MinPasswordLength 20 -PasswordHistoryCount 24 -ComplexityEnabled `$true" -ForegroundColor Gray
Write-Host "    Add-ADFineGrainedPasswordPolicySubject 'PSO-ServiceAccounts' -Subjects '$ServiceAccountSAM'" -ForegroundColor Gray

Write-Host "`n[5/5] Teste de reset de senha em usuario comum" -ForegroundColor Cyan
if ($TestUserSAM) {
    try {
        $testUser = Get-ADUser $TestUserSAM -ErrorAction Stop
        Write-Host "  Usuario de teste: $($testUser.DistinguishedName)"

        # Verify not in privileged groups
        $testGroups = $testUser.MemberOf | ForEach-Object { (Get-ADGroup $_).Name }
        $testDangerous = $testGroups | Where-Object { $privilegedGroups -contains $_ }
        if ($testDangerous) {
            Write-Host "  ABORTADO: Usuario de teste e privilegiado. Escolha outro." -ForegroundColor Red
        } else {
            # Use the service account credentials
            $plainPw = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ServiceAccountPassword)
            )
            $cred = New-Object System.Management.Automation.PSCredential(
                "$ServiceAccountSAM@$((Get-ADDomain).DNSRoot)",
                $ServiceAccountPassword
            )

            $newTestPw = ConvertTo-SecureString "Teste@12345!" -AsPlainText -Force
            Set-ADAccountPassword -Identity $testUser -NewPassword $newTestPw -Reset -Credential $cred
            Write-Host "  Senha resetada com sucesso para o usuario $TestUserSAM!" -ForegroundColor Green
            Write-Host "  Nova senha temporaria: Teste@12345! (altere imediatamente)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  Erro no teste: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  Nenhum usuario de teste informado. Use -TestUserSAM para testar." -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Configuracao concluida!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Dados para o arquivo .env:" -ForegroundColor White
Write-Host "  AD_BIND_DN = CN=Servico - Self Password Reset,$ServiceAccountOU" -ForegroundColor Gray
Write-Host "  AD_ALLOWED_OUS = $AllowedOU" -ForegroundColor Gray
Write-Host ""
Write-Host " Proximos passos:" -ForegroundColor White
Write-Host "  1. Habilitar LDAPS no Domain Controller" -ForegroundColor Gray
Write-Host "  2. Exportar o certificado CA e colocar em /certs/ca.crt" -ForegroundColor Gray
Write-Host "  3. Configurar o arquivo .env com os dados acima" -ForegroundColor Gray
Write-Host "  4. Executar: docker compose up -d" -ForegroundColor Gray
