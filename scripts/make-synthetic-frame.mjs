// Renders a 768×432 JPEG "ad frame" with Arabic on-screen text (claim + discount code) for provider tests.
import { chromium } from "@playwright/test";
const out = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 768, height: 432 } });
await p.setContent(`<html dir="rtl"><body style="margin:0;width:768px;height:432px;background:linear-gradient(#2d6a4f,#1b4332);font-family:Tahoma,sans-serif;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px">
<div style="font-size:54px;font-weight:700">شاي التنحيف السحري</div>
<div style="font-size:40px;background:#e63946;padding:8px 24px;border-radius:12px">ينحف ٥ كيلو في أسبوع — مضمون!</div>
<div style="font-size:36px">كود الخصم: SLIM50</div></body></html>`);
await p.screenshot({ path: out, type: "jpeg", quality: 85 });
await b.close();
console.log("wrote", out);
