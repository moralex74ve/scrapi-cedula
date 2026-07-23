const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const CAMPOS_EXCLUIDOS = new Set([
  "fuente",
  "timestamp",
  "estado",
  "municipio",
  "parroquia",
  "centro_electoral",
]);

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    nombre: "API Verificador de Cédula Venezolana",
    version: "1.0.0",
    endpoint: "GET /api/verificar?cedula=12345",
  });
});

app.get("/api/verificar", async (req, res) => {
  const { cedula } = req.query;
  if (!cedula || !/^\d+$/.test(cedula)) {
    return res.status(400).json({ error: "Cédula inválida. Solo números." });
  }
  try {
    const resultado = await verificarCedula(cedula);
    res.json(resultado);
  } catch (error) {
    console.error("Error:", error.message);
    res
      .status(500)
      .json({ error: "Error al consultar la cédula", detalles: error.message });
  }
});

app.post("/api/verificar", async (req, res) => {
  const { cedula } = req.body;
  if (!cedula || !/^\d+$/.test(cedula)) {
    return res.status(400).json({ error: "Cédula inválida. Solo números." });
  }
  try {
    const resultado = await verificarCedula(cedula);
    res.json(resultado);
  } catch (error) {
    console.error("Error:", error.message);
    res
      .status(500)
      .json({ error: "Error al consultar la cédula", detalles: error.message });
  }
});

async function verificarCedula(cedula) {
  const formRes = await fetch("https://www.sistemaspnp.com/cedula/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const html = await formRes.text();
  const cookies = formRes.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map((c) => c.split(";")[0]).join("; ");

  const captchaMatch = html.match(/CAPTCHA:.*?(\d+)\s*\+\s*(\d+)/);
  if (!captchaMatch)
    throw new Error("No se pudo leer el captcha del formulario");
  const captchaAnswer = parseInt(captchaMatch[1]) + parseInt(captchaMatch[2]);

  const postRes = await fetch(
    "https://www.sistemaspnp.com/cedula/resultado.php",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieStr,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://www.sistemaspnp.com/cedula/",
      },
      body: new URLSearchParams({
        cedula: cedula,
        captcha: String(captchaAnswer),
        jeje: "",
      }),
    },
  );

  const resultHtml = await postRes.text();
  return parsearResultado(resultHtml, cedula);
}

function parsearResultado(html, cedula) {
  const datos = { cedula };

  const strongRegex = /<strong>([^<:]+):\s*<\/strong>\s*([^<\n]+)/gi;
  let match;
  while ((match = strongRegex.exec(html)) !== null) {
    let key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
    let val = match[2].trim();
    if (key && val && !CAMPOS_EXCLUIDOS.has(key)) {
      datos[key] = val;
    }
  }

  return datos;
}

app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
