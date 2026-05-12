# Portal de Recuperação de Senha — Active Directory

Self-service password reset para Active Directory. Usuários redefinam a própria senha com múltipla validação de identidade, sem contato com o suporte.

## Arquitetura

```
nginx (TLS) → backend (Node.js/Express) → Active Directory (LDAPS)
                    ↕
              SQLite (sessões, OTP, fatores, auditoria)
```

## Fluxo de reset

1. **Identificação** — usuário informa login, e-mail ou matrícula
2. **OTP** — código enviado para e-mail pessoal ou WhatsApp (expira em 5 min)
3. **2º Fator** — perguntas de segurança, data de nascimento ou últimos 4 dígitos da matrícula
4. **Nova senha** — validação de complexidade + update via LDAPS (`unicodePwd`)
5. **Sucesso** — conta desbloqueada automaticamente se estava bloqueada

## Pré-requisitos

- Docker + Docker Compose (v2)
- Domain Controller com LDAPS habilitado
- Conta de serviço com permissão de reset na OU permitida
- SMTP funcional para envio de OTP
- (Opcional) webhook WhatsApp/SMS

---

## 1. Instalação local (desenvolvimento)

```bash
git clone <repo>
cd pass-ad-reset

# Backend
cd backend
cp .env.example .env
# edite .env com suas configurações
npm install
npm run dev       # porta 3000

# Frontend (outro terminal)
cd frontend
npm install
npm run dev       # http://localhost:5173
```

---

## 2. Deploy com Docker

```bash
cp backend/.env.example backend/.env
# edite backend/.env com suas configurações reais

# Coloque o certificado CA do AD em:
mkdir certs
cp /caminho/ca.crt certs/ca.crt

docker compose up -d --build
```

Acesse: `https://senha.empresa.com.br`

---

## 3. Configurar o Active Directory

### 3.1 Habilitar LDAPS no Domain Controller

```powershell
# Verificar se LDAPS já responde:
Test-NetConnection -ComputerName dc01.empresa.local -Port 636

# Para instalar certificado via AD CS (CA interna):
# Snap-in "Certificates" → Local Computer → Personal → Request New Certificate
# Template: "Domain Controller" ou "Kerberos Authentication"
```

### 3.2 Exportar certificado CA

```powershell
# No DC, exporte a CA raiz:
certutil -ca.cert C:\ca-root.cer

# Copie para o servidor Linux:
scp C:\ca-root.cer usuario@servidor:/opt/pass-ad-reset/certs/ca.crt
```

### 3.3 Criar conta de serviço e delegar permissões

```powershell
.\setup-ad.ps1 `
  -AllowedOU "OU=Usuarios,DC=empresa,DC=local" `
  -ServiceAccountOU "OU=Servicos,DC=empresa,DC=local" `
  -ServiceAccountPassword (Read-Host -AsSecureString "Senha") `
  -TestUserSAM "usuario.teste"
```

O script: cria `svc_self_password_reset`, delega `User-Force-Change-Password` e `Write lockoutTime` apenas na OU permitida, remove da conta quaisquer grupos privilegiados, testa reset em usuário comum.

---

## 4. Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `AD_URL` | `ldaps://dc01.empresa.local:636` |
| `AD_BASE_DN` | `DC=empresa,DC=local` |
| `AD_BIND_DN` | DN completo da conta de serviço |
| `AD_BIND_PASSWORD` | Senha da conta de serviço |
| `AD_ALLOWED_OUS` | OUs permitidas, separadas por `;` |
| `AD_CA_CERT_PATH` | `/certs/ca.crt` |
| `SESSION_SECRET` | 64+ chars aleatórios |
| `ENCRYPTION_KEY` | 64 chars hex (AES-256-GCM) |
| `SMTP_HOST` | Servidor SMTP |
| `WHATSAPP_WEBHOOK_URL` | Webhook opcional |

```bash
# Gerar ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Gerar SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 5. Cadastro inicial de fatores de recuperação

Antes de usar o portal, cada usuário deve acessar → "Cadastrar dados de recuperação" e informar:
- E-mail pessoal (não corporativo)
- Telefone/WhatsApp
- Data de nascimento
- 2 perguntas + respostas de segurança

Dados são criptografados em AES-256-GCM. Se o AD já tiver `mail`, `mobile`, `employeeID` populados, esses campos são usados como fallback.

---

## 6. Segurança em produção

### Obrigatório
- [ ] `NODE_ENV=production`
- [ ] HTTPS com certificado válido
- [ ] `SESSION_SECRET` e `ENCRYPTION_KEY` aleatórios e guardados em cofre
- [ ] LDAPS com `AD_TLS_REJECT_UNAUTHORIZED=true`
- [ ] Firewall: porta 3000 acessível apenas pelo nginx

### O que NÃO fazer
- ❌ HTTP em produção
- ❌ `AD_TLS_REJECT_UNAUTHORIZED=false` em produção
- ❌ Expor porta 3000 diretamente
- ❌ Commitar `.env` ou chaves em repositórios

---

## 7. Auditoria

Logs em dois destinos simultâneos:

1. **SQLite** (`/app/data/app.db`, tabela `audit_log`)
2. **Arquivo rotativo** (`/app/logs/audit-YYYY-MM-DD.log`) — JSON, retido 90 dias

```bash
# Falhas recentes:
sqlite3 /app/data/app.db "SELECT datetime(timestamp,'unixepoch','localtime'), ip, step, failure_reason FROM audit_log WHERE success=0 ORDER BY timestamp DESC LIMIT 50;"

# Resets bem-sucedidos:
sqlite3 /app/data/app.db "SELECT datetime(timestamp,'unixepoch','localtime'), ip, ad_username FROM audit_log WHERE step='password_reset' AND success=1;"
```

---

## 8. Estrutura do projeto

```
pass-ad-reset/
├── backend/
│   ├── server.js
│   ├── Dockerfile
│   ├── .env.example
│   └── src/
│       ├── routes/            # auth.js, otp.js, password.js
│       ├── controllers/       # authController, otpController, passwordController
│       ├── services/          # adService, otpService, auditService, notificationService, cryptoService
│       ├── middlewares/       # rateLimiter, validation, requireSession
│       └── database/          # index.js (SQLite)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/             # 6 páginas
│   │   ├── components/        # ProgressBar, PasswordStrength, OtpInput
│   │   └── styles/global.css
│   └── Dockerfile
├── nginx/nginx.conf
├── docker-compose.yml
├── setup-ad.ps1
└── README.md
```
