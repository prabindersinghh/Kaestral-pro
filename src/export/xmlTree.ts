// Minimal XML tree + renderer, shared by the XMEML and FCPXML exporters. `render` owns all
// indentation and escaping so no emitter hardcodes whitespace (ports XMLExporter.swift render).

export interface XmlNode {
  name: string;
  attributes: [string, string][];
  text?: string;
  children: XmlNode[];
}

export function el(name: string, children: XmlNode[] = []): XmlNode {
  return { name, attributes: [], children };
}
export function elAttrs(name: string, attributes: [string, string][], children: XmlNode[] = []): XmlNode {
  return { name, attributes, children };
}
export function leaf(name: string, value: string | number): XmlNode {
  return { name, attributes: [], text: String(value), children: [] };
}
export function boolLeaf(name: string, value: boolean): XmlNode {
  return { name, attributes: [], text: value ? "TRUE" : "FALSE", children: [] };
}

export function render(node: XmlNode, indent = 0): string {
  const pad = " ".repeat(indent);
  const attrs = node.attributes.map(([k, v]) => ` ${k}="${escapeXML(v)}"`).join("");
  if (node.text !== undefined) {
    return `${pad}<${node.name}${attrs}>${escapeXML(node.text)}</${node.name}>`;
  }
  if (node.children.length === 0) return `${pad}<${node.name}${attrs}/>`;
  const inner = node.children.map((c) => render(c, indent + 2)).join("\n");
  return `${pad}<${node.name}${attrs}>\n${inner}\n${pad}</${node.name}>`;
}

export function escapeXML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
