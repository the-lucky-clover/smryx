// Normalize decorative UI markup without enabling arbitrary model-generated HTML.
export function cleanSummaryText(value) {
  return String(value || "").split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`+[^`\n]*`+)/g)
    .map((part, index) => index % 2 ? part : part
      .replace(/(?:<|&lt;)icon\b[\s\S]*?(?:>|&gt;)/gi, tag => /\bclapperboard\b/i.test(tag) ? "🎬" : "")
      .replace(/(?:<|&lt;)\/icon\s*(?:>|&gt;)/gi, "")
      .replace(/(?:<|&lt;)\/?text\b[\s\S]*?(?:>|&gt;)/gi, ""))
    .join("");
}

function textOf(node) {
  return node?.value ?? (node?.children || []).map(textOf).join("");
}

// Slice inline nodes by their visible text so links and emphasis survive the split.
function sliceInline(nodes, start, end) {
  let offset = 0;
  return nodes.flatMap(node => {
    const length = textOf(node).length;
    const from = Math.max(0, start - offset), to = Math.min(length, end - offset);
    offset += length;
    if (to <= from) return [];
    if (from === 0 && to === length) return [node];
    if (node.children) return [{...node, children: sliceInline(node.children, from, to)}];
    return [{...node, value: node.value.slice(from, to)}];
  });
}

function splitParagraphs(paragraphs) {
  const inline = paragraphs.flatMap((node, index) => index ? [{type: "text", value: " "}, ...node.children] : node.children);
  const text = inline.map(textOf).join("");
  const segments = typeof Intl.Segmenter === "function"
    ? [...new Intl.Segmenter(undefined, {granularity: "sentence"}).segment(text)]
    : [...text.matchAll(/[^.!?。！？]+[.!?。！？]+\s*|[^.!?。！？]+$/gu)].map(match => ({index: match.index, segment: match[0]}));
  const boundaries = segments.slice(1).map(segment => segment.index);
  if (!boundaries.length) return paragraphs.map(node => ({...node, data: {hProperties: {className: ["bm-tldr-paragraph"]}}}));
  const middle = boundaries.reduce((best, index) => Math.abs(index - text.length / 2) < Math.abs(best - text.length / 2) ? index : best);
  return [[0, middle], [middle, text.length]].map(([start, end]) => ({
    type: "paragraph",
    data: {hProperties: {className: ["bm-tldr-paragraph"]}},
    children: sliceInline(inline, start, end)
  }));
}

// Works with Markdown headings and with the numbered/bold section titles in the
// built-in prompt. Only TL;DR prose is reflowed; lists and code remain intact.
export function summaryParagraphs() {
  return tree => {
    const visit = parent => {
      if (!parent.children) return;
      for (let index = 0; index < parent.children.length; index++) {
        const node = parent.children[index];
        if (node.type === "paragraph" && node.children[0]?.type === "strong" && /^TL\s*;?\s*DR\b/i.test(textOf(node.children[0]).trim()) && node.children.slice(1).some(child => textOf(child).trim())) {
          const body = {type: "paragraph", children: node.children.slice(1)};
          node.children = node.children.slice(0, 1);
          parent.children.splice(index + 1, 0, body);
        }
        // An unindented paragraph after "1. **TL;DR**" is a sibling of a
        // one-item ordered list, rather than a child of that list item.
        const title = (node.type === "list" && node.children.length === 1 ? node.children[0].children[0] : node) ?? node;
        const label = textOf(title).trim();
        if (["heading", "paragraph"].includes(title.type) && /^(?:\d+[.)]\s*)?TL\s*;?\s*DR\b/i.test(label)) {
          // A title is either a heading or a paragraph consisting of bold text.
          const isTitle = title.type === "heading" || title.children.every(child => child.type === "strong" || (child.type === "text" && !child.value.trim())) || /^TL\s*;?\s*DR(?:\s+Summary)?\s*(?:\([^)]*\))?\s*:?$/i.test(label);
          if (isTitle) {
            let end = index + 1;
            while (parent.children[end]?.type === "paragraph") {
              const next = parent.children[end];
              if (next.children.some(child => child.type === "strong") && next.children.every(child => child.type === "strong" || (child.type === "text" && !child.value.trim()))) break;
              end++;
            }
            const prose = parent.children.slice(index + 1, end);
            if (prose.length) {
              const replacement = splitParagraphs(prose);
              parent.children.splice(index + 1, prose.length, ...replacement);
              if (parent.type === "listItem") parent.spread = true;
              index += replacement.length;
            }
          }
        }
        visit(node);
      }
    };
    visit(tree);
  };
}
