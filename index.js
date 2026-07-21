import express from "express";
import sdk from "stremio-addon-sdk";
const { addonBuilder, getRouter } = sdk;

// Manifesto base do Addon para Stremio
const manifest = {
    id: "community.resolution-filter",
    version: "1.0.0",
    name: "! Filtro de Resolução",
    description: "Filtra streams do Stremio por resoluções específicas (4K, 1080p, 720p, 480p) e consolida múltiplas fontes dinâmicas.",
    resources: ["stream"],
    types: ["movie", "series"],
    catalogs: [],
    idPrefixes: ["tt"],
    config: [
        {
            key: "resolution",
            type: "select",
            title: "Filtro de Resolução",
            options: [
                "Todas as Resoluções (All)",
                "Apenas 4K (2160p)",
                "Apenas 1080p (Full HD)",
                "Apenas 720p (HD)",
                "Apenas 480p (SD)",
                "1080p e 4K (Full HD & 4K)",
                "720p ou superior (720p, 1080p, 4K)"
            ],
            default: "Todas as Resoluções (All)"
        },
        {
            key: "upstreamUrls",
            type: "text",
            title: "URLs dos Addons Upstream (separadas por vírgula)",
            default: "https://torrentio.strem.fun, https://torrentio.strem.fun/lite, https://torrentio.strem.fun/brazuca"
        }
    ],
    behaviorHints: {
        configurable: true,
        configurationRequired: false
    }
};

/**
 * Fontes padrão de backup
 */
const DEFAULT_UPSTREAMS = [
    "https://torrentio.strem.fun",
    "https://torrentio.strem.fun/lite",
    "https://torrentio.strem.fun/brazuca"
];

/**
 * Ordem de prioridade para exibição dos streams no Stremio
 */
const RESOLUTION_PRIORITY = {
    "4k": 1,
    "1080p": 2,
    "720p": 3,
    "480p": 4,
    "unknown": 5
};

/**
 * Obtém o selo conciso da resolução selecionada para exibição limpa no Stremio.
 */
function getResolutionLabel(resolutionKey) {
    if (!resolutionKey) return "Todas as Resoluções";
    const res = resolutionKey.toLowerCase();

    if (res.includes("4k") && !res.includes("1080p") && !res.includes("720p") && !res.includes("all") && !res.includes("todas")) {
        return "1080p Apenas";
    }
    if (res.includes("1080p") && !res.includes("4k") && !res.includes("720p") && !res.includes("all") && !res.includes("todas")) {
        return "1080p Apenas";
    }
    if (res.includes("720p") && !res.includes("1080p") && !res.includes("4k") && !res.includes("all") && !res.includes("todas")) {
        return "720p Apenas";
    }
    if (res.includes("480p")) {
        return "480p Apenas";
    }
    if (res.includes("1080p_above") || res.includes("full hd & 4k") || res.includes("full hd + 4k")) {
        return "1080p e 4K";
    }
    if (res.includes("720p_above") || res.includes("720p ou superior")) {
        return "720p ou superior";
    }

    return "Todas as Resoluções";
}

/**
 * Detecta a resolução de um stream analisando nome, título, descrição e qualidade.
 */
function detectResolution(stream) {
    if (!stream) return "unknown";

    const textToAnalyze = [
        stream.name,
        stream.title,
        stream.description,
        stream.quality
    ].filter(Boolean).join(" ");

    if (/\b(4k|2160p|uhd|2160)\b/i.test(textToAnalyze)) {
        return "4k";
    }
    if (/\b(1080p|1080|fhd|full[\s._-]?hd)\b/i.test(textToAnalyze)) {
        return "1080p";
    }
    if (/\b(720p|720|hd)\b/i.test(textToAnalyze)) {
        if (!/\b(h264|x264|h265|x265)\b/i.test(textToAnalyze) || /\b720p?\b/i.test(textToAnalyze)) {
            return "720p";
        }
    }
    if (/\b(480p|480|sd|360p|360)\b/i.test(textToAnalyze)) {
        return "480p";
    }

    return "unknown";
}

/**
 * Extrai e formata o nome da fonte para o Stremio agrupar no 1º LUGAR da lista do menu dropdown superior.
 */
function formatStreamName(stream, resolution, config) {
    const rawName = (stream.name || "").trim();
    const parts = rawName.split("\n");
    const displayRes = resolution !== "unknown" ? resolution.toUpperCase() : (parts[1] || "");

    const label = getResolutionLabel(config?.resolution);
    // Prefixo '!' (ASCII 33) garante que seja ordenado em 1º lugar absoluto no menu do Stremio
    const headerName = `! Filtro (${label})`;

    return displayRes ? `${headerName}\n${displayRes}` : headerName;
}

/**
 * Verifica se a resolução detectada é permitida de acordo com a seleção no Menu Dropdown ou Checkboxes.
 */
function isResolutionAllowed(resolution, config) {
    if (!config) return true;
    if (resolution === "unknown") return true;

    const selectedRes = (config.resolution || "").toLowerCase();

    if (selectedRes.includes("4k") && !selectedRes.includes("1080p") && !selectedRes.includes("720p") && !selectedRes.includes("all") && !selectedRes.includes("todas")) {
        return resolution === "4k";
    }
    if (selectedRes.includes("1080p") && !selectedRes.includes("4k") && !selectedRes.includes("720p") && !selectedRes.includes("all") && !selectedRes.includes("todas")) {
        return resolution === "1080p";
    }
    if (selectedRes.includes("720p") && !selectedRes.includes("1080p") && !selectedRes.includes("4k") && !selectedRes.includes("all") && !selectedRes.includes("todas")) {
        return resolution === "720p";
    }
    if (selectedRes.includes("480p")) {
        return resolution === "480p";
    }
    if (selectedRes.includes("1080p_above") || selectedRes.includes("full hd & 4k") || selectedRes.includes("full hd + 4k")) {
        return resolution === "1080p" || resolution === "4k";
    }
    if (selectedRes.includes("720p_above") || selectedRes.includes("720p ou superior")) {
        return resolution === "720p" || resolution === "1080p" || resolution === "4k";
    }
    if (selectedRes.includes("all") || selectedRes.includes("todas")) {
        return true;
    }

    if (config.res_4k !== undefined || config.res_1080p !== undefined) {
        const val = config[`res_${resolution}`];
        if (val !== undefined) {
            return val === true || val === "true" || val === "on" || val === "checked";
        }
    }

    return true;
}

/**
 * Extrai lista de URLs de upstream configuradas pelo usuário.
 */
function getUpstreamUrls(config) {
    const rawUrls = config?.upstreamUrls || config?.upstreamUrl;
    if (!rawUrls || typeof rawUrls !== "string" || !rawUrls.trim()) {
        return DEFAULT_UPSTREAMS;
    }

    const urls = rawUrls
        .split(",")
        .map(url => url.trim().replace(/\/manifest\.json$/i, "").replace(/\/+$/, ""))
        .filter(url => url.startsWith("http://") || url.startsWith("https://"));

    return urls.length > 0 ? urls : DEFAULT_UPSTREAMS;
}

// Inicializa o construtor do Addon Stremio
const builder = new addonBuilder(manifest);

// Handler de Streams
builder.defineStreamHandler(async ({ type, id, config }) => {
    console.log(`[Stream Request] Type: ${type}, ID: ${id}, Config:`, config);

    const upstreamUrls = getUpstreamUrls(config);
    console.log(`[Stream Request] Consultando ${upstreamUrls.length} fontes upstream simultaneamente:`, upstreamUrls);

    const fetchPromises = upstreamUrls.map(async (baseUrl) => {
        const streamUrl = `${baseUrl}/stream/${type}/${id}.json`;
        try {
            const response = await fetch(streamUrl, {
                signal: AbortSignal.timeout(4000)
            });
            if (response.ok) {
                const data = await response.json();
                return data.streams || [];
            } else {
                console.warn(`[Stream Request] ${baseUrl} respondeu status ${response.status}`);
            }
        } catch (error) {
            console.error(`[Stream Request] Erro ao consultar ${baseUrl}:`, error.message);
        }
        return [];
    });

    const results = await Promise.allSettled(fetchPromises);

    let aggregatedStreams = [];
    for (const res of results) {
        if (res.status === "fulfilled" && Array.isArray(res.value)) {
            aggregatedStreams = aggregatedStreams.concat(res.value);
        }
    }

    console.log(`[Stream Request] Total de streams agregados: ${aggregatedStreams.length}`);

    if (aggregatedStreams.length === 0) {
        return { streams: [] };
    }

    const filteredStreams = [];
    for (const stream of aggregatedStreams) {
        const resolution = detectResolution(stream);
        
        if (!isResolutionAllowed(resolution, config)) {
            continue;
        }

        const formattedStream = {
            ...stream,
            name: formatStreamName(stream, resolution, config)
        };

        filteredStreams.push(formattedStream);
    }

    filteredStreams.sort((a, b) => {
        const resA = detectResolution(a);
        const resB = detectResolution(b);
        return (RESOLUTION_PRIORITY[resA] || 99) - (RESOLUTION_PRIORITY[resB] || 99);
    });

    console.log(`[Stream Request] Streams ordenados e exibidos em 1º lugar após filtro: ${filteredStreams.length}`);

    return { streams: filteredStreams };
});

// HTML moderno, responsivo e com guia visual incrível para o /configure
const configureHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stremio Resolution Filter - Configuração & Guia de Uso</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: radial-gradient(circle at 50% 0%, #201040 0%, #0b0817 100%);
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px 15px;
            overflow-x: hidden;
        }
        .wrapper {
            width: 100%;
            max-width: 1050px;
        }
        .hero {
            text-align: center;
            margin-bottom: 35px;
        }
        .hero-title {
            font-size: 36px;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff 0%, #c499f8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
            letter-spacing: -0.5px;
        }
        .hero-subtitle {
            font-size: 16px;
            color: #a4a4cf;
            max-width: 620px;
            margin: 0 auto 20px auto;
            line-height: 1.6;
        }
        .badges {
            display: flex;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        .badge {
            background: rgba(138, 90, 171, 0.15);
            border: 1px solid rgba(138, 90, 171, 0.3);
            color: #d6b4fc;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 28px;
        }
        @media (max-width: 850px) {
            .grid { grid-template-columns: 1fr; }
            .hero-title { font-size: 28px; }
        }
        .card {
            background: rgba(255, 255, 255, 0.04);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.4);
            display: flex;
            flex-direction: column;
        }
        .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            padding-bottom: 16px;
        }
        .card-icon {
            width: 42px;
            height: 42px;
            background: linear-gradient(135deg, #8A5AAB 0%, #5d2882 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 4px 15px rgba(138, 90, 171, 0.4);
        }
        .card-title {
            font-size: 20px;
            font-weight: 700;
            color: #ffffff;
        }
        .form-group {
            margin-bottom: 22px;
        }
        label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #d8d8f0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        select, textarea {
            width: 100%;
            padding: 14px 16px;
            background: rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
            transition: all 0.2s ease;
        }
        select:focus, textarea:focus {
            border-color: #8A5AAB;
            box-shadow: 0 0 14px rgba(138, 90, 171, 0.4);
        }
        select option { background: #160e2e; color: #fff; }
        textarea { resize: vertical; min-height: 95px; font-family: monospace; font-size: 12px; line-height: 1.5; }
        .hint { font-size: 12px; color: #8a8ab0; margin-top: 6px; }
        .btn-primary {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #8A5AAB 0%, #6c3483 100%);
            border: none;
            border-radius: 12px;
            color: #ffffff;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(138, 90, 171, 0.45);
            transition: all 0.2s ease;
            margin-top: 8px;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 30px rgba(138, 90, 171, 0.65);
        }
        .btn-secondary {
            width: 100%;
            padding: 12px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            color: #d8b4fc;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.2s ease;
        }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.12); }
        
        .step-list {
            display: flex;
            flex-direction: column;
            gap: 18px;
        }
        .step-item {
            display: flex;
            gap: 16px;
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.06);
            padding: 14px;
            border-radius: 12px;
            align-items: flex-start;
        }
        .step-number {
            width: 32px;
            height: 32px;
            min-width: 32px;
            background: rgba(138, 90, 171, 0.25);
            border: 1px solid #8A5AAB;
            color: #e2c4ff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
        }
        .step-text h4 {
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 4px;
        }
        .step-text p {
            font-size: 12px;
            color: #9f9fc5;
            line-height: 1.5;
        }
        .highlight {
            color: #d6b4fc;
            font-weight: 600;
        }
        .preview-box {
            background: rgba(138, 90, 171, 0.1);
            border: 1px dashed rgba(138, 90, 171, 0.4);
            border-radius: 10px;
            padding: 12px;
            margin-top: 16px;
            text-align: center;
            font-size: 12px;
            color: #c499f8;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #6d6d90;
        }
        .footer a { color: #8A5AAB; text-decoration: none; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="hero">
            <h1 class="hero-title">🎬 Stremio Resolution Filter</h1>
            <p class="hero-subtitle">Filtre os links de vídeo por qualidade e consolide múltiplas fontes de torrents no topo da sua lista do Stremio.</p>
            <div class="badges">
                <span class="badge">🥇 1º Lugar no Menu</span>
                <span class="badge">☁️ Hospedado na Nuvem</span>
                <span class="badge">📺 TV, Mobile e Desktop</span>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-header">
                    <div class="card-icon">⚙️</div>
                    <div class="card-title">Configurar Addon</div>
                </div>

                <form id="configForm">
                    <div class="form-group">
                        <label for="resolution">Filtro de Resolução</label>
                        <select id="resolution" name="resolution">
                            <option value="all">Todas as Resoluções (All)</option>
                            <option value="4k">Apenas 4K (2160p)</option>
                            <option value="1080p" selected>Apenas 1080p (Full HD)</option>
                            <option value="720p">Apenas 720p (HD)</option>
                            <option value="480p">Apenas 480p (SD)</option>
                            <option value="1080p_above">1080p e 4K (Full HD & 4K)</option>
                            <option value="720p_above">720p ou superior (720p, 1080p, 4K)</option>
                        </select>
                        <div class="hint">Escolha quais resoluções deseja visualizar no Stremio.</div>
                    </div>

                    <div class="form-group">
                        <label for="upstreamUrls">Addons de Origem (Upstream)</label>
                        <textarea id="upstreamUrls" name="upstreamUrls">https://torrentio.strem.fun, https://torrentio.strem.fun/lite, https://torrentio.strem.fun/brazuca</textarea>
                        <div class="hint">URLs dos addons que fornecem as fontes (separadas por vírgula).</div>
                    </div>

                    <button type="button" id="installBtn" class="btn-primary">🚀 INSTALAR NO STREMIO</button>
                    <button type="button" id="copyBtn" class="btn-secondary">📋 Copiar Link do Manifesto (para Smart TV)</button>
                </form>
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="card-icon">📖</div>
                    <div class="card-title">Como Usar no Stremio</div>
                </div>

                <div class="step-list">
                    <div class="step-item">
                        <div class="step-number">1</div>
                        <div class="step-text">
                            <h4>Escolha sua Resolução</h4>
                            <p>No painel ao lado, selecione o filtro desejado (ex: <span class="highlight">Apenas 1080p</span> ou <span class="highlight">1080p e 4K</span>).</p>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-number">2</div>
                        <div class="step-text">
                            <h4>Clique em Instalar</h4>
                            <p>Clique no botão <span class="highlight">INSTALAR NO STREMIO</span>. Seu aplicativo do Stremio abrirá solicitando confirmação.</p>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-number">3</div>
                        <div class="step-text">
                            <h4>Abra Qualquer Filme ou Série</h4>
                            <p>No Stremio, selecione a mídia que deseja assistir para carregar as opções de reprodução.</p>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-number">4</div>
                        <div class="step-text">
                            <h4>Veja o Filtro no 1º Lugar da Lista</h4>
                            <p>No menu suspenso do canto superior direito do Stremio, o seu filtro aparecerá no <span class="highlight">1º LUGAR da lista com o caractere '!'</span> exibindo os vídeos filtrados!</p>
                        </div>
                    </div>
                </div>

                <div class="preview-box">
                    💡 <strong>Dica para Smart TV:</strong> Clique em "Copiar Link do Manifesto", abra a aba Addons da sua TV e cole a URL salva!
                </div>
            </div>
        </div>

        <div class="footer">
            Stremio Resolution Filter Addon • Código aberto no <a href="https://github.com/danielgoqueiroz/stremio-filter-by-resolution" target="_blank">GitHub</a>
        </div>
    </div>

    <script>
        function getManifestUrl() {
            const form = document.getElementById('configForm');
            const resolution = form.resolution.value;
            const upstreamUrls = form.upstreamUrls.value;

            const config = {
                resolution: resolution,
                upstreamUrls: upstreamUrls
            };

            const configPath = encodeURIComponent(JSON.stringify(config));
            return window.location.origin + '/' + configPath + '/manifest.json';
        }

        document.getElementById('installBtn').onclick = () => {
            const manifestUrl = getManifestUrl();
            const installUrl = manifestUrl.replace('https://', 'stremio://').replace('http://', 'stremio://');
            window.location.href = installUrl;
        };

        document.getElementById('copyBtn').onclick = () => {
            const manifestUrl = getManifestUrl();
            navigator.clipboard.writeText(manifestUrl).then(() => {
                const copyBtn = document.getElementById('copyBtn');
                copyBtn.innerText = '✅ Link do Manifesto Copiado!';
                setTimeout(() => {
                    copyBtn.innerText = '📋 Copiar Link do Manifesto (para Smart TV)';
                }, 3000);
            }).catch(err => {
                alert('URL do Manifesto: ' + manifestUrl);
            });
        };
    </script>
</body>
</html>`;

// Cria a aplicação Express
const app = express();

// Middleware Global de CORS
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// Rota customizada para entregar o manifesto dinâmico ordenado em 1º LUGAR no menu do Stremio
app.get("/:config/manifest.json", (req, res, next) => {
    try {
        const config = JSON.parse(req.params.config);
        const resLabel = getResolutionLabel(config.resolution);
        const dynamicManifest = {
            ...manifest,
            name: `! Filtro (${resLabel})`
        };
        if (dynamicManifest.behaviorHints) {
            delete dynamicManifest.behaviorHints.configurable;
            delete dynamicManifest.behaviorHints.configurationRequired;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.json(dynamicManifest);
    } catch (e) {
        return next();
    }
});

// Serve a página de configuração customizada no / e no /configure
app.get(["/", "/configure"], (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(configureHTML);
});

// Conecta as rotas padrão do Stremio Addon SDK (/manifest.json, /stream/..., etc.)
app.use(getRouter(builder.getInterface()));

// Porta dinâmica (exigida por hospedagens em nuvem como Vercel, Beamup, Render)
const PORT = process.env.PORT || process.env.PORT_ADDON || 7000;

app.listen(PORT, () => {
    console.log(`Addon de Filtro de Resolução rodando na porta ${PORT}`);
    console.log(`Página de Configuração: http://localhost:${PORT}/configure`);
    console.log(`Manifesto Stremio: http://localhost:${PORT}/manifest.json`);
});

export default app;
