# 🗺️ Mapa Denúncias Urbanas

Plataforma colaborativa onde moradores podem reportar problemas urbanos — buracos, iluminação quebrada, alagamentos, lixo irregular — diretamente no mapa da sua cidade.

## ✨ Funcionalidades

- Mapa interativo com todos os problemas reportados em tempo real
- Registro de denúncias com foto, categoria e geolocalização automática
- Login com Google
- Pins no mapa atualizados automaticamente para todos os usuários (WebSocket)
- Status da denúncia: aberto, em andamento ou resolvido

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + Vanilla JS + Leaflet.js |
| Backend | Python + FastAPI |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth (Google OAuth) |
| Upload de fotos | Cloudinary |
| Mapa | OpenStreetMap (gratuito, sem chave de API) |

## 🚀 Como rodar localmente

### Pré-requisitos
- Python 3.11+
- Conta no [Supabase](https://supabase.com)
- Conta no [Cloudinary](https://cloudinary.com)

### 1. Clone o repositório
```bash
git clone https://github.com/Marco-ferreira08/mapa-denuncias.git
cd mapa-denuncias
```

### 2. Crie o ambiente virtual e instale as dependências
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_KEY=sua_service_key
CLOUDINARY_CLOUD_NAME=seu_cloud_name
CLOUDINARY_API_KEY=sua_api_key
CLOUDINARY_API_SECRET=seu_api_secret
CLOUDINARY_UPLOAD_PRESET=seu_preset
```

### 4. Configure o banco de dados
No SQL Editor do Supabase, rode os scripts em `database/schema.sql`

### 5. Rode o backend
```bash
uvicorn app.main:app --reload
```

### 6. Abra o frontend
Abra o arquivo `index.html` com Live Server ou qualquer servidor local.

## 🗄️ Estrutura do projeto

mapa-denuncias/
├── app/
│   ├── init.py
│   └── main.py          # API FastAPI
├── index.html           # Frontend
├── style.css            # Estilos
├── app.js               # Lógica do frontend
├── requirements.txt     # Dependências Python
├── render.yaml          # Config de deploy
└── .env                 # Variáveis de ambiente (não commitado)

## 🌍 Impacto social

Este projeto nasceu da necessidade de dar voz aos cidadãos. Qualquer pessoa pode reportar um problema urbano em segundos, criando um banco de dados público e colaborativo que pode ser usado por jornalistas, vereadores e prefeituras para priorizar melhorias na cidade.

## 📄 Licença

MIT

## Imagens

<img width="573" height="297" alt="image" src="https://github.com/user-attachments/assets/de869ff0-c6bf-41b8-afb9-a6554286c2e8" />

<img width="474" height="479" alt="image" src="https://github.com/user-attachments/assets/8d0ade84-5ea2-4cd1-a004-ab709b9d7aed" />

<img width="705" height="379" alt="image" src="https://github.com/user-attachments/assets/b2602ad1-2658-4f28-b8fb-ab071fe290a4" />

