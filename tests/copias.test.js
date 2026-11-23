// O servidor do assistente usa cópias exatas de arquivos do app (para publicar pela CLI). Se um mudar e a cópia não, o app e a IA passam a dizer coisas diferentes.
const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs"); const path = require("path");
const raiz = path.join(__dirname, "..");
for (const nome of ["dominio.js", "pacote.js", "relatorio-visual.js"]) {
  test(`cópia do servidor igual ao app: ${nome}`, () => {
    const app = fs.readFileSync(path.join(raiz, "assets/js", nome), "utf8"); const copia = fs.readFileSync(path.join(raiz, "supabase/functions/assistente", nome), "utf8");
    assert.equal(copia, app, `supabase/functions/assistente/${nome} diverge de assets/js/${nome}: copie o arquivo do app`);
  });
}
test("a entrada da função carrega o módulo visual antes das ferramentas de impressão", () => {
  const ts = fs.readFileSync(path.join(raiz, "supabase/functions/assistente/index.ts"), "utf8"); const ordem = [...ts.matchAll(/import "\.\/([a-z-]+\.js)"/g)].map((m) => m[1]);
  assert.ok(ordem.indexOf("relatorio-visual.js") >= 0 && ordem.indexOf("relatorio-visual.js") < ordem.indexOf("ferramentas-impressao.js"), ordem.join(" > "));
  assert.ok(ordem.indexOf("ferramentas-leitura.js") < ordem.indexOf("ferramentas-impressao.js") && ordem.indexOf("ferramentas-impressao.js") < ordem.indexOf("nucleo.js"));
});
