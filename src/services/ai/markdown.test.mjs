import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

test('renders assistant Markdown while dropping raw HTML, images and unsafe link URLs', () => {
  const content = '# Resumo\n\n**Total**\n\n- Item\n\n| Nome | Valor |\n| --- | --- |\n| A | 10 |\n\n<img src="example" onerror="alert(1)" />\n\n![Pixel](https://example.org/pixel)\n\n[Abrir](javascript:alert%281%29)';
  const html = renderToStaticMarkup(createElement(Markdown, { skipHtml: true, disallowedElements: ['img'], remarkPlugins: [remarkGfm] }, content));
  assert.match(html, /<h1>Resumo<\/h1>/);
  assert.match(html, /<strong>Total<\/strong>/);
  assert.match(html, /<li>Item<\/li>/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<img|onerror|javascript:/);
});
