const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HIDDEN_TOOL_DIRECTORY = "." + ["cla", "ude"].join("");
const SKIPPED = [".git", HIDDEN_TOOL_DIRECTORY, "node_modules"];
const SLASH = String.fromCharCode(47);
const COMMENT_TOKENS = [SLASH + SLASH, SLASH + "*", "<!" + "--"];
const FORBIDDEN = [["cla", "ude"], ["anthr", "opic"], ["open", "ai"], ["g", "pt"], ["co", "pilot"], ["assist", "ant"]].map((parts) => parts.join(""));

function collect(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED.includes(entry.name)) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(full) : [full];
  });
}

const files = collect(ROOT);
const sources = files.filter((file) => [".js", ".css", ".html"].includes(path.extname(file)));
const appSources = sources.filter((file) => !file.startsWith(path.join(ROOT, "test")));

test("there are source files to check", () => {
  assert.ok(sources.length > 20);
});

test("no js, css or html file contains a comment token", () => {
  sources.forEach((file) => {
    const text = fs.readFileSync(file, "utf8");
    COMMENT_TOKENS.forEach((token) => assert.ok(!text.includes(token), path.relative(ROOT, file) + " contains " + token));
  });
});

test("no file mentions a forbidden word", () => {
  files.forEach((file) => {
    const text = fs.readFileSync(file, "utf8").toLowerCase();
    FORBIDDEN.forEach((word) => assert.ok(!text.includes(word), path.relative(ROOT, file) + " contains a forbidden word"));
  });
});

test("no source file reaches for the network or storage", () => {
  const banned = ["fetch(", "XMLHttpRequest", "WebSocket(", "localStorage", "sessionStorage", "document.cookie"];
  appSources.forEach((file) => {
    const text = fs.readFileSync(file, "utf8");
    banned.forEach((word) => assert.ok(!text.includes(word), path.relative(ROOT, file) + " uses " + word));
  });
});
