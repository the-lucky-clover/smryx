const fs = require('node:fs'), path = require('node:path');
const footer = `<footer class="wrap corporate-footer">
  <div class="corporate-brand"><a class="wordmark" href="./"><img src="assets/mark.svg" alt="" width="30" height="30">SmryX</a><p>Less noise. A little more knowing.</p><small>© 2026 SmryX. An independent project.</small></div>
  <nav aria-label="Product"><h2>Explore</h2><a href="./#how-it-works">How it works</a><a href="./#get-started">Get SmryX</a><a href="https://github.com/the-lucky-clover/smryx">Source code ↗</a></nav>
  <nav aria-label="Legal and support"><h2>Project &amp; legal</h2><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Use</a><button type="button" data-analytics-choices hidden>Analytics choices</button><a href="https://github.com/the-lucky-clover/smryx/issues">Contact &amp; support ↗</a></nav>
</footer>`;
for (const name of ['index.html','privacy.html','terms.html']) {
  const file = path.join(__dirname,'../docs',name);
  const html = fs.readFileSync(file,'utf8');
  if (!/<footer\b[\s\S]*?<\/footer>/.test(html)) throw Error(`Missing footer in ${name}`);
  fs.writeFileSync(file,html.replace(/<footer\b[\s\S]*?<\/footer>/,footer));
}
