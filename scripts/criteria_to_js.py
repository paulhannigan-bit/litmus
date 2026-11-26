"""Write app/lib/criteria.js from app/public/criteria.json (run from the litmus/app folder)."""
import json
c = json.load(open("public/criteria.json", encoding="utf-8"))
with open("lib/criteria.js", "w", encoding="utf-8") as f:
    f.write("// Generated from public/criteria.json. Plain JS so every bundler (Cloudflare, Vercel, Node) can load it.\n")
    f.write("// Regenerate after changing the standards: python3 -I ../scripts/criteria_to_js.py\n")
    f.write("export default " + json.dumps(c, ensure_ascii=False, indent=1) + ";\n")
