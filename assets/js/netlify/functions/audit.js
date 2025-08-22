// netlify/functions/audit.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const PSI_KEY = process.env.PSI_API_KEY;
  const url = event.queryStringParameters.url;

  if (!url || !PSI_KEY) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: 'Missing URL or PSI_API_KEY' }),
    };
  }

  try {
    const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${PSI_KEY}&category=performance`;
    const response = await fetch(psiUrl);
    const data = await response.json();

    const lr = data.lighthouseResult;
    const metrics = {
      score: Math.round((lr.categories.performance.score || 0) * 100),
      fcp: lr.audits['first-contentful-paint'].displayValue,
      lcp: lr.audits['largest-contentful-paint'].displayValue,
      cls: lr.audits['cumulative-layout-shift'].displayValue,
      tbt: lr.audits['total-blocking-time'].displayValue,
      speedIndex: lr.audits['speed-index'].displayValue,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, metrics }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
