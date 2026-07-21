# 🎬 Stremio Resolution Filter (Plugin de Filtro de Resolução e Múltiplas Fontes)

Um addon/plugin para o **Stremio** que consolida fontes de múltiplos provedores (ex: Torrentio, Torrentio Lite, Torrentio Brazuca, etc.) e permite **filtrar os streams por resolução** através de um **Menu Dropdown por Resolução** (4K, 1080p, 720p, 480p) na página de configuração.

Compatível com o **menu suspenso (dropdown)** nativo do Stremio para filtro de provedores (*All*, *Torrentio*, *Torrentio Lite*, *Torrentio Brazuca*).

---

## ☁️ Como Fazer Deploy Gratuito no Beamup (Sem Precisar do PC Ligado)

O **Beamup** é o serviço oficial de hospedagem na nuvem **100% gratuito** do Stremio. Ao publicar seu plugin no Beamup, ele roda 24/7 na nuvem e funciona na sua Smart TV, celular e PC sem você precisar rodar nenhum comando no computador.

### Passo a Passo de Publicação no Beamup:

#### 1. Criar um Repositório no GitHub
Se você ainda não enviou o projeto para o GitHub:
1. Acesse [github.com/new](https://github.com/new) e crie um repositório chamado `stremio-filter-by-resolution`.
2. No terminal da pasta do projeto, execute os comandos:
   ```bash
   git init
   git add .
   git commit -m "Addon de Filtro de Resolução Stremio"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/stremio-filter-by-resolution.git
   git push -u origin main
   ```

#### 2. Conectar ao Beamup
1. Acesse o site do Beamup: **[https://beamup.strem.fun](https://beamup.strem.fun)**
2. Faça login com a sua conta do **GitHub**.
3. Autorize o Beamup e selecione o repositório `stremio-filter-by-resolution`.
4. Clique no botão **Deploy**.

#### 3. Instalar no Stremio
1. O Beamup gerará um link permanente de hospedagem na nuvem, no formato:
   ```text
   https://stremio-filter-by-resolution.beamup.dev/manifest.json
   ```
2. Acesse a página de configuração do seu addon publicado:
   ```text
   https://stremio-filter-by-resolution.beamup.dev/configure
   ```
3. Escolha a resolução desejada no **Menu Dropdown**, ajuste as fontes e clique em **INSTALAR NO STREMIO**.
4. **Pronto!** Seu plugin funcionará para sempre em todos os seus dispositivos.

---

## 🚀 Funcionalidades

- **Menu Dropdown por Resolução**: Escolha a regra de filtro em um menu suspenso simples:
  - *Todas as Resoluções (All)*
  - *Apenas 4K (2160p)*
  - *Apenas 1080p (Full HD)*
  - *Apenas 720p (HD)*
  - *Apenas 480p (SD)*
  - *1080p e 4K (Full HD & 4K)*
  - *720p ou superior (720p, 1080p, 4K)*
- **URLs dos Addons Upstream Editáveis**: As fontes upstream (ex: Torrentio, Torrentio Lite, Torrentio Brazuca) aparecem preenchidas na página de configuração, podendo ser personalizadas.
- **Carregamento Dinâmico de Múltiplas Fontes**: Consulta múltiplos addons simultaneamente em paralelo (`Promise.allSettled`).
- **Integração com o Menu Dropdown de Provedores do Stremio**: Preserva o nome do provedor no campo `stream.name`, alimentando o seletor nativo do aplicativo Stremio.
- **Pronto para Nuvem (Beamup/Render/Vercel)**: Configurado com porta dinâmica (`process.env.PORT`) e scripts de entrada `server.js`.

---

## 🛠️ Execução Local para Testes (Opcional)

Se quiser testar o projeto no seu computador antes de enviar ao Beamup:

### 1. Instalar as Dependências
```bash
npm install
```

### 2. Iniciar o Servidor Local
```bash
npm start
```

Acesse a página local em: `http://localhost:7000/configure`.

---

## 📄 Licença

Este projeto é de código aberto sob a licença [MIT](LICENSE).
