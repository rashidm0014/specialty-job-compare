import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const bodyEnd = html.indexOf("<div class=\"toast\" id=\"toast\"></div>");
const prefix = html.slice(0, bodyEnd + '<div class="toast" id="toast"></div>'.length);

const headInsert = prefix.includes('rel="manifest"')
  ? prefix
  : prefix.replace(
      '<link rel="stylesheet" href="styles.css">',
      '<link rel="stylesheet" href="styles.css">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icons/icon.svg" type="image/svg+xml">'
    );

const suffix = `
<script src="phase2.js"></script>
<script src="app.js"></script>
<script src="phase1.js"></script>
<script>init();</script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, "index.html"), headInsert + suffix);
console.log("Rebuilt index.html");
