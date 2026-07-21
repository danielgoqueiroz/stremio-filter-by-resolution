import express from "express";
import sdk from "stremio-addon-sdk";
const { addonBuilder, getRouter } = sdk;

// Manifesto base do Addon para Stremio
const manifest = {
    id: "community.resolution-filter",
    version: "1.0.0",
    name: "Filtro de Resolução",
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
 * Obtém o selo conciso da resolução selecionada para exibição limpa no Stremio.
 */
function getResolutionLabel(resolutionKey) {
    if (!resolutionKey) return "Todas";
    const res = resolutionKey.toLowerCase();

    if (res.includes("4k") && !res.includes("1080p") && !res.includes("720p") && !res.includes("all") && !res.includes("todas")) {
        return "4K Apenas";
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
        return "1080p + 4K";
    }
    if (res.includes("720p_above") || res.includes("720p ou superior")) {
        return "720p+";
    }

    return "Todas";
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
 * Extrai e formata o nome da fonte para o Stremio agrupar no menu dropdown superior.
 */
function formatStreamName(stream, resolution, config) {
    const rawName = (stream.name || "").trim();
    const parts = rawName.split("\n");
    const sourceName = parts[0] || "Torrentio";
    const displayRes = resolution !== "unknown" ? resolution.toUpperCase() : (parts[1] || "");

    const label = getResolutionLabel(config?.resolution);
    const headerName = label !== "Todas" ? `${sourceName} [${label}]` : sourceName;

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

    // Consulta concorrente com timeout de 4s para responder rapidamente na nuvem/serverless
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

        // Preserva 100% das propriedades originais do stream (url, infoHash, fileIdx, behaviorHints, etc.)
        const formattedStream = {
            ...stream,
            name: formatStreamName(stream, resolution, config)
        };

        filteredStreams.push(formattedStream);
    }

    console.log(`[Stream Request] Streams exibidos após filtro: ${filteredStreams.length}`);

    return { streams: filteredStreams };
});

// HTML customizado e moderno para a página de configuração /configure
const configureHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuração - Filtro de Resolução Stremio</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0f0c20 0%, #1a103c 100%);
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 40px;
            width: 100%;
            max-width: 540px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { font-size: 26px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
        .header p { font-size: 14px; color: #a0a0c0; }
        .form-group { margin-bottom: 24px; }
        label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #d0d0f0; }
        select, textarea {
            width: 100%;
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
            transition: all 0.2s ease;
        }
        select:focus, textarea:focus {
            border-color: #8A5AAB;
            box-shadow: 0 0 10px rgba(138, 90, 171, 0.3);
        }
        select option { background: #1a103c; color: #fff; }
        textarea { resize: vertical; min-height: 90px; font-family: monospace; font-size: 12px; line-height: 1.5; }
        .hint { font-size: 12px; color: #8080a0; margin-top: 6px; }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #8A5AAB 0%, #6c3483 100%);
            border: none;
            border-radius: 8px;
            color: #ffffff;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 8px 20px rgba(138, 90, 171, 0.4);
            transition: transform 0.1s ease, box-shadow 0.2s ease;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 25px rgba(138, 90, 171, 0.6);
        }
        button:active { transform: translateY(0); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Filtro de Resolução Stremio</h1>
            <p>Selecione a resolução desejada e gerencie as fontes upstream do seu plugin.</p>
        </div>

        <form id="configForm">
            <div class="form-group">
                <label for="resolution">Menu Dropdown por Resolução</label>
                <select id="resolution" name="resolution">
                    <option value="all">Todas as Resoluções (All)</option>
                    <option value="4k">Apenas 4K (2160p)</option>
                    <option value="1080p">Apenas 1080p (Full HD)</option>
                    <option value="720p">Apenas 720p (HD)</option>
                    <option value="480p">Apenas 480p (SD)</option>
                    <option value="1080p_above">1080p e 4K (Full HD & 4K)</option>
                    <option value="720p_above">720p ou superior (720p, 1080p, 4K)</option>
                </select>
                <div class="hint">Filtra os links exibidos no Stremio pela resolução escolhida.</div>
            </div>

            <div class="form-group">
                <label for="upstreamUrls">URLs dos Addons Upstream (separadas por vírgula)</label>
                <textarea id="upstreamUrls" name="upstreamUrls">https://torrentio.strem.fun, https://torrentio.strem.fun/lite, https://torrentio.strem.fun/brazuca</textarea>
                <div class="hint">Insira as URLs dos addons de onde o plugin irá buscar as fontes.</div>
            </div>

            <button type="button" id="installBtn">INSTALAR NO STREMIO</button>
        </form>
    </div>

    <script>
        document.getElementById('installBtn').onclick = () => {
            const form = document.getElementById('configForm');
            const resolution = form.resolution.value;
            const upstreamUrls = form.upstreamUrls.value;

            const config = {
                resolution: resolution,
                upstreamUrls: upstreamUrls
            };

            const configPath = encodeURIComponent(JSON.stringify(config));
            const installUrl = 'stremio://' + window.location.host + '/' + configPath + '/manifest.json';
            
            window.location.href = installUrl;
        };
    </script>
</body>
</html>`;

// Cria a aplicação Express
const app = express();

// Middleware Global de CORS (Garante Access-Control-Allow-Origin: * em todas as rotas e preflights)
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// Rota customizada para entregar o manifesto dinâmico com a descrição da resolução no nome do addon
app.get("/:config/manifest.json", (req, res, next) => {
    try {
        const config = JSON.parse(req.params.config);
        const resLabel = getResolutionLabel(config.resolution);
        const dynamicManifest = {
            ...manifest,
            name: `Filtro (${resLabel})`
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
