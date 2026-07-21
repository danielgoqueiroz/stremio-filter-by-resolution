# 🎬 Stremio Resolution Filter (Plugin de Filtro de Resolução e Múltiplas Fontes)

Um addon/plugin para o **Stremio** que consolida fontes de múltiplos provedores (ex: Torrentio, Torrentio Lite, Torrentio Brazuca, etc.) e permite **filtrar os streams por resolução** através de um **Menu Dropdown por Resolução** (4K, 1080p, 720p, 480p) na página de configuração.

Compatível com o **menu suspenso (dropdown)** nativo do Stremio para filtro de provedores (*All*, *Torrentio*, *Torrentio Lite*, *Torrentio Brazuca*).

---

## ☁️ Como Fazer Deploy Gratuito na Nuvem (Vercel ou Render)

Como o Beamup se encontra instável/fora do ar, as duas melhores alternativas **100% gratuitas, rápidas e sem queda** para hospedar addons do Stremio são o **Vercel** e o **Render**.

### Opção 1: Deploy na Vercel (Recomendado - Instantâneo)

A Vercel oferece hospedagem serverless gratuita e com tempo de atividade impecável.

1. Acesse **[vercel.com](https://vercel.com/)** e faça login/cadastro gratuito com sua conta do **GitHub**.
2. Clique em **"Add New..."** -> **"Project"**.
3. Na lista de repositórios do seu GitHub, selecione o repositório **`stremio-filter-by-resolution`**.
4. Clique em **Deploy** (não precisa alterar nenhuma configuração de build).
5. Em menos de 1 minuto, a Vercel gerará a sua URL pública permanente no formato:
   ```text
   https://stremio-filter-by-resolution-xxx.vercel.app/configure
   ```
6. Acesse essa URL no seu navegador, escolha a resolução no **Menu Dropdown** e clique em **INSTALAR NO STREMIO**.

---

### Opção 2: Deploy no Render.com (Alternativa Gratuita)

1. Acesse **[render.com](https://render.com/)** e faça login gratuito com o GitHub.
2. Clique em **New +** -> **Web Service**.
3. Conecte o repositório **`stremio-filter-by-resolution`**.
4. Defina:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Clique em **Create Web Service**.
6. Após a inicialização, você receberá a URL pública no formato:
   ```text
   https://stremio-filter-by-resolution.onrender.com/configure
   ```

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
- **Pronto para Nuvem (Vercel/Render/Beamup)**: Arquivos `vercel.json`, `api/index.js` e `server.js` prontos para deploy automático via GitHub.

---

## 🛠️ Execução Local para Testes (Opcional)

Se quiser testar o projeto no seu computador:

```bash
npm install
npm start
```

Acesse a página local em: `http://localhost:7000/configure`.

---

## 📄 Licença

Este projeto é de código aberto sob a licença [MIT](LICENSE).
