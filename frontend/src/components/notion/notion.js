import React, { useState, useRef, useCallback, useEffect } from 'react';
import './notion.css';

// ── Constants ────────────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Default', value: 'inherit' },
  { label: 'Black',   value: '#0D0D0D' },
  { label: 'Gray',    value: '#888888' },
  { label: 'Red',     value: '#E84040' },
  { label: 'Orange',  value: '#FF9F43' },
  { label: 'Yellow',  value: '#FFD166' },
  { label: 'Green',   value: '#00CC52' },
  { label: 'Blue',    value: '#0984E3' },
  { label: 'Purple',  value: '#6C5CE7' },
  { label: 'Pink',    value: '#E84393' },
];

const BG_COLORS = [
  { label: 'None',         value: 'transparent' },
  { label: 'Gray bg',      value: '#EBEBEB' },
  { label: 'Red bg',       value: '#FFE0E0' },
  { label: 'Orange bg',    value: '#FFF0DC' },
  { label: 'Yellow bg',    value: '#FFFBD6' },
  { label: 'Green bg',     value: '#DCFFEE' },
  { label: 'Blue bg',      value: '#DCF0FF' },
  { label: 'Purple bg',    value: '#F0DCFF' },
  { label: 'Pink bg',      value: '#FFE0F5' },
];

const CODE_LANGUAGES = ['javascript', 'python', 'typescript', 'html', 'css', 'bash', 'sql', 'json', 'rust', 'go', 'java', 'cpp'];

const CHART_COLORS = ['#00FF66', '#0984E3', '#FFD166', '#FF6B6B', '#B197FC', '#74C0FC'];

let _blockId = 1;
function createBlock(type = 'paragraph', content = '', extraProps = {}) {
  return {
    id: `b${_blockId++}`,
    type,
    content,
    color: 'inherit',
    bgColor: 'transparent',
    align: 'left',
    bold: false,
    italic: false,
    underline: false,
    // code block
    language: 'javascript',
    // table block: stored as rows×cols array
    tableRows: [['', '', ''], ['', '', ''], ['', '', '']],
    tableCols: 3,
    tableHasHeader: true,
    // chart
    chartType: 'bar',
    chartTitle: 'Chart Title',
    chartLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    chartValues: [42, 68, 35, 82, 55],
    // url
    urlHref: '',
    urlTitle: '',
    urlDesc: '',
    ...extraProps,
  };
}

// ── SVG Charts ───────────────────────────────────────────────────────
function BarChart({ labels, values, title }) {
  const max = Math.max(...values, 1);
  const W = 520, H = 180, PAD = 40, BAR_GAP = 8;
  const barW = (W - PAD * 2 - BAR_GAP * (values.length - 1)) / values.length;
  return (
    <svg width={W} height={H + 50} className="notion__chart-svg">
      <text x={W / 2} y={18} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0D0D0D">{title}</text>
      {values.map((v, i) => {
        const bh = ((v / max) * (H - 30));
        const x = PAD + i * (barW + BAR_GAP);
        const y = H - bh + 10;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} fill={CHART_COLORS[i % CHART_COLORS.length]} rx="3" />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="#444">{v}</text>
            <text x={x + barW / 2} y={H + 22} textAnchor="middle" fontSize="10" fill="#888">{labels[i]}</text>
          </g>
        );
      })}
      <line x1={PAD - 5} y1={10} x2={PAD - 5} y2={H + 10} stroke="#D4D4D4" strokeWidth="1"/>
      <line x1={PAD - 5} y1={H + 10} x2={W - PAD + 5} y2={H + 10} stroke="#D4D4D4" strokeWidth="1"/>
    </svg>
  );
}

function LineChart({ labels, values, title }) {
  const max = Math.max(...values, 1);
  const W = 520, H = 180, PAD = 40;
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - ((v / max) * (H - 30)) + 10;
    return { x, y, v, label: labels[i] };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${pts[pts.length-1].x},${H+10} L${pts[0].x},${H+10} Z`;
  return (
    <svg width={W} height={H + 50} className="notion__chart-svg">
      <text x={W / 2} y={18} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0D0D0D">{title}</text>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00FF66" stopOpacity=".3"/>
          <stop offset="100%" stopColor="#00FF66" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#lineGrad)"/>
      <path d={pathD} stroke="#00CC52" strokeWidth="2" fill="none" strokeLinejoin="round"/>
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#00FF66" stroke="#fff" strokeWidth="1.5"/>
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fill="#444">{p.v}</text>
          <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize="10" fill="#888">{p.label}</text>
        </g>
      ))}
      <line x1={PAD - 5} y1={10} x2={PAD - 5} y2={H + 10} stroke="#D4D4D4" strokeWidth="1"/>
      <line x1={PAD - 5} y1={H + 10} x2={W - PAD + 5} y2={H + 10} stroke="#D4D4D4" strokeWidth="1"/>
    </svg>
  );
}

function PieChart({ labels, values, title }) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = 120, cy = 110, r = 85;
  let angle = -Math.PI / 2;
  const slices = values.map((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const mx = cx + (r * 0.65) * Math.cos(angle - sweep / 2);
    const my = cy + (r * 0.65) * Math.sin(angle - sweep / 2);
    return { d: `M${cx},${cy} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} Z`, color: CHART_COLORS[i % CHART_COLORS.length], pct: Math.round(v / total * 100), mx, my, label: labels[i] };
  });
  return (
    <svg width={480} height={230} className="notion__chart-svg">
      <text x={240} y={18} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0D0D0D">{title}</text>
      {slices.map((s, i) => (
        <g key={i}>
          <path d={s.d} fill={s.color} stroke="#fff" strokeWidth="2"/>
          {s.pct > 5 && <text x={s.mx} y={s.my} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="600">{s.pct}%</text>}
        </g>
      ))}
      {slices.map((s, i) => (
        <g key={i} transform={`translate(260, ${30 + i * 22})`}>
          <rect x={0} y={0} width={12} height={12} fill={s.color} rx="2"/>
          <text x={18} y={10} fontSize="11" fill="#444">{s.label} ({values[i]})</text>
        </g>
      ))}
    </svg>
  );
}

// ── Chart Edit Modal ─────────────────────────────────────────────────
function ChartModal({ block, onSave, onClose }) {
  const [chartType, setChartType] = useState(block.chartType);
  const [title, setTitle] = useState(block.chartTitle);
  const [labelsRaw, setLabelsRaw] = useState(block.chartLabels.join(', '));
  const [valuesRaw, setValuesRaw] = useState(block.chartValues.join(', '));

  const parsed = {
    labels: labelsRaw.split(',').map(s => s.trim()).filter(Boolean),
    values: valuesRaw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)),
  };

  const save = () => onSave({ chartType, chartTitle: title, chartLabels: parsed.labels, chartValues: parsed.values });

  return (
    <div className="notion__overlay" onClick={onClose}>
      <div className="notion__sub-modal" onClick={e => e.stopPropagation()}>
        <div className="notion__sub-modal-header">
          EDIT CHART
          <button onClick={onClose}>✕</button>
        </div>
        <div className="notion__sub-modal-body">
          <label className="notion__form-label">CHART TYPE</label>
          <div className="notion__chart-type-row">
            {['bar', 'line', 'pie'].map(t => (
              <button key={t} className={`notion__chart-type-btn ${chartType === t ? 'notion__chart-type-btn--active' : ''}`}
                onClick={() => setChartType(t)}>{t.toUpperCase()}</button>
            ))}
          </div>
          <label className="notion__form-label">TITLE</label>
          <input className="notion__form-input" value={title} onChange={e => setTitle(e.target.value)} />
          <label className="notion__form-label">LABELS (comma-separated)</label>
          <input className="notion__form-input" value={labelsRaw} onChange={e => setLabelsRaw(e.target.value)} placeholder="Jan, Feb, Mar, Apr" />
          <label className="notion__form-label">VALUES (comma-separated)</label>
          <input className="notion__form-input" value={valuesRaw} onChange={e => setValuesRaw(e.target.value)} placeholder="42, 68, 35, 82" />
          <div className="notion__chart-preview">
            {chartType === 'bar'  && <BarChart  labels={parsed.labels} values={parsed.values} title={title} />}
            {chartType === 'line' && <LineChart labels={parsed.labels} values={parsed.values} title={title} />}
            {chartType === 'pie'  && <PieChart  labels={parsed.labels} values={parsed.values} title={title} />}
          </div>
        </div>
        <button className="notion__sub-modal-confirm" onClick={save}>APPLY CHART</button>
      </div>
    </div>
  );
}

// ── URL Block Modal ──────────────────────────────────────────────────
function URLModal({ block, onSave, onClose }) {
  const [href, setHref] = useState(block.urlHref);
  const [title, setTitle] = useState(block.urlTitle);
  const [desc, setDesc] = useState(block.urlDesc);
  return (
    <div className="notion__overlay" onClick={onClose}>
      <div className="notion__sub-modal" onClick={e => e.stopPropagation()}>
        <div className="notion__sub-modal-header">EMBED URL <button onClick={onClose}>✕</button></div>
        <div className="notion__sub-modal-body">
          <label className="notion__form-label">URL</label>
          <input className="notion__form-input" value={href} onChange={e => setHref(e.target.value)} placeholder="https://..." />
          <label className="notion__form-label">TITLE</label>
          <input className="notion__form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Page title" />
          <label className="notion__form-label">DESCRIPTION (optional)</label>
          <input className="notion__form-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short description..." />
        </div>
        <button className="notion__sub-modal-confirm" onClick={() => onSave({ urlHref: href, urlTitle: title, urlDesc: desc })}>EMBED</button>
      </div>
    </div>
  );
}

// ── Export Modal — click a format to immediately download ─────────────
function ExportModal({ pages, title, onClose }) {
  const [format, setFormat] = useState('');
  const [exporting, setExporting] = useState(false);

  const blocksToText = (blocks) =>
    blocks.map(b => {
      if (['paragraph','h1','h2','h3','quote','bullet','numbered'].includes(b.type)) return b.content;
      if (b.type === 'code') return b.content;
      if (b.type === 'divider') return '---';
      if (b.type === 'url') return `${b.urlTitle}: ${b.urlHref}`;
      if (b.type === 'table') return b.tableRows.map(r => r.join(' | ')).join('\n');
      if (b.type === 'chart') return `[Chart: ${b.chartTitle}]`;
      return '';
    }).filter(Boolean).join('\n');

  const blocksToMarkdown = (blocks) =>
    blocks.map(b => {
      if (b.type === 'h1') return `# ${b.content}`;
      if (b.type === 'h2') return `## ${b.content}`;
      if (b.type === 'h3') return `### ${b.content}`;
      if (b.type === 'paragraph') return b.content;
      if (b.type === 'quote') return `> ${b.content}`;
      if (b.type === 'bullet') return `- ${b.content}`;
      if (b.type === 'numbered') return `1. ${b.content}`;
      if (b.type === 'divider') return '---';
      if (b.type === 'code') return `\`\`\`${b.language}\n${b.content}\n\`\`\``;
      if (b.type === 'url') return `[${b.urlTitle || b.urlHref}](${b.urlHref})`;
      if (b.type === 'table') {
        const rows = b.tableRows.map((r, ri) => `| ${r.join(' | ')} |`);
        if (b.tableHasHeader) rows.splice(1, 0, `|${b.tableRows[0].map(() => '---').join('|')}|`);
        return rows.join('\n');
      }
      if (b.type === 'chart') return `**[${b.chartType.toUpperCase()} Chart: ${b.chartTitle}]**\nData: ${b.chartValues.join(', ')}`;
      return '';
    }).filter(Boolean).join('\n\n');

  const blocksToHTML = (blocks) => blocks.map(b => {
    const style = `color:${b.color};background:${b.bgColor};text-align:${b.align}`;
    if (b.type === 'h1') return `<h1 style="${style}">${b.content}</h1>`;
    if (b.type === 'h2') return `<h2 style="${style}">${b.content}</h2>`;
    if (b.type === 'h3') return `<h3 style="${style}">${b.content}</h3>`;
    if (b.type === 'paragraph') return `<p style="${style}">${b.content}</p>`;
    if (b.type === 'quote') return `<blockquote style="border-left:3px solid #0D0D0D;padding-left:16px;${style}">${b.content}</blockquote>`;
    if (b.type === 'bullet') return `<ul><li>${b.content}</li></ul>`;
    if (b.type === 'numbered') return `<ol><li>${b.content}</li></ol>`;
    if (b.type === 'divider') return `<hr/>`;
    if (b.type === 'code') return `<pre><code class="language-${b.language}">${b.content}</code></pre>`;
    if (b.type === 'url') return `<a href="${b.urlHref}" target="_blank" style="display:block;padding:12px;border:1px solid #ddd;border-radius:6px;text-decoration:none;color:#0D0D0D"><strong>${b.urlTitle}</strong><br/>${b.urlDesc}</a>`;
    if (b.type === 'table') {
      const trs = b.tableRows.map((row, ri) => {
        const tag = (ri === 0 && b.tableHasHeader) ? 'th' : 'td';
        return `<tr>${row.map(c => `<${tag} style="border:1px solid #ddd;padding:8px">${c}</${tag}>`).join('')}</tr>`;
      }).join('');
      return `<table style="border-collapse:collapse;width:100%">${trs}</table>`;
    }
    return '';
  }).filter(Boolean).join('\n');

  const doExport = (fmt) => {
    const selectedFormat = fmt || format;
    const allBlocks = pages.flatMap(p => p.blocks);
    const docTitle = title;

    if (selectedFormat === 'pdf') {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title>
        <style>body{font-family:sans-serif;max-width:794px;margin:auto;padding:48px;line-height:1.7}
        h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.2em}
        pre{background:#f5f5f5;padding:16px;border-radius:6px;overflow:auto;font-family:monospace}
        hr{border:none;border-top:1px solid #ddd;margin:24px 0}
        table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}
        @page{size:A4;margin:25mm}</style></head>
        <body>${pages.map((p, i) => `<div class="page"><h4 style="color:#888;font-size:10px">PAGE ${i + 1}</h4>${blocksToHTML(p.blocks)}</div>`).join('<div style="page-break-after:always"></div>')}</body></html>`;
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
      return;
    }

    let content, mime, ext;
    if (selectedFormat === 'md') {
      content = `# ${docTitle}\n\n` + pages.map((p, i) => `\n\n${blocksToMarkdown(p.blocks)}`).join('\n\n---\n\n');
      mime = 'text/markdown'; ext = 'md';
    } else if (selectedFormat === 'html') {
      const body = pages.map((p, i) => `\n${blocksToHTML(p.blocks)}`).join('\n<hr style="page-break-after:always"/>\n');
      content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>body{font-family:sans-serif;max-width:794px;margin:40px auto;padding:0 48px;line-height:1.7}pre{background:#f5f5f5;padding:16px;border-radius:6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}</style></head><body>${body}</body></html>`;
      mime = 'text/html'; ext = 'html';
    } else {
      content = pages.map((p, i) => `=== PAGE ${i + 1} ===\n\n${blocksToText(p.blocks)}`).join('\n\n');
      mime = 'text/plain'; ext = 'txt';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${docTitle.toLowerCase().replace(/\s+/g, '_')}.${ext}`;
    a.click(); URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="notion__overlay" onClick={onClose}>
      <div className="notion__sub-modal" onClick={e => e.stopPropagation()}>
        <div className="notion__sub-modal-header">EXPORT DOCUMENT <button onClick={onClose}>✕</button></div>
        <div className="notion__sub-modal-body">
          <label className="notion__form-label">SELECT FORMAT</label>
          <div className="notion__export-formats">
            {[
              { id: 'pdf',  label: 'PDF',      desc: 'Print-ready A4 document' },
              { id: 'md',   label: 'MARKDOWN', desc: 'Plain text with formatting' },
              { id: 'html', label: 'HTML',     desc: 'Web-ready document' },
              { id: 'txt',  label: 'TXT',      desc: 'Plain text, no formatting' },
            ].map(f => (
              <button key={f.id}
                className={`notion__export-format ${format === f.id ? 'notion__export-format--active' : ''}`}
                onClick={() => { setFormat(f.id); doExport(f.id); }}>
                <span className="notion__export-format-name">{f.label}</span>
                <span className="notion__export-format-desc">{f.desc}</span>
              </button>
            ))}
          </div>
          <p className="notion__export-info">
            {pages.length} page{pages.length > 1 ? 's' : ''} · {pages.flatMap(p => p.blocks).length} blocks total
          </p>
        </div>
        <p className="notion__export-click-hint">↑ Click a format above to download immediately</p>
      </div>
    </div>
  );
}

// ── Single Block Component ────────────────────────────────────────────
const Block = React.memo(function Block({ block, isSelected, onSelect, onChange, onKeyDown, onAddAfter, onDelete, onChartEdit, onURLEdit }) {
  const ref = useRef(null);
  const isText = ['paragraph','h1','h2','h3','quote','bullet','numbered'].includes(block.type);

  useEffect(() => {
    if (ref.current && isText && ref.current.innerText !== block.content) {
      const sel = window.getSelection();
      const hadFocus = document.activeElement === ref.current;
      ref.current.innerText = block.content;
      if (hadFocus && sel && ref.current.firstChild) {
        try {
          const range = document.createRange();
          const node = ref.current.firstChild;
          const offset = Math.min(block.content.length, node.length || 0);
          range.setStart(node, offset);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {}
      }
    }
  }, [block.content, isText]);

  const style = {
    color: block.color !== 'inherit' ? block.color : undefined,
    background: block.bgColor !== 'transparent' ? block.bgColor : undefined,
    textAlign: block.align,
    fontWeight: block.bold ? 700 : undefined,
    fontStyle: block.italic ? 'italic' : undefined,
    textDecoration: block.underline ? 'underline' : undefined,
  };

  const handleInput = () => { if (ref.current) onChange({ content: ref.current.innerText }); };
  const handleKeyDownLocal = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddAfter(); }
    if (e.key === 'Backspace' && block.content === '') { e.preventDefault(); onDelete(); }
    onKeyDown?.(e);
  };

  // Render by type
  if (block.type === 'divider') {
    return (
      <div className={`notion__block notion__block--divider ${isSelected ? 'notion__block--selected' : ''}`}
        onClick={() => onSelect(block.id)}>
        <hr className="notion__hr" />
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <div className={`notion__block notion__block--code ${isSelected ? 'notion__block--selected' : ''}`}
        onClick={() => onSelect(block.id)}>
        <div className="notion__code-header">
          <select className="notion__code-lang"
            value={block.language}
            onChange={e => onChange({ language: e.target.value })}>
            {CODE_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button className="notion__code-copy" onClick={() => navigator.clipboard.writeText(block.content)}>
            COPY
          </button>
        </div>
        <textarea
          className="notion__code-textarea"
          value={block.content}
          onChange={e => onChange({ content: e.target.value })}
          placeholder="// Write code here..."
          spellCheck={false}
          rows={Math.max(3, block.content.split('\n').length)}
        />
      </div>
    );
  }

  if (block.type === 'table') {
    const rows = block.tableRows;
    const updateCell = (ri, ci, val) => {
      const newRows = rows.map((r, rIdx) => r.map((c, cIdx) => (rIdx === ri && cIdx === ci ? val : c)));
      onChange({ tableRows: newRows });
    };
    const addRow = () => onChange({ tableRows: [...rows, Array(block.tableCols).fill('')] });
    const addCol = () => onChange({ tableRows: rows.map(r => [...r, '']), tableCols: block.tableCols + 1 });
    const removeRow = (ri) => rows.length > 1 && onChange({ tableRows: rows.filter((_, i) => i !== ri) });
    const removeCol = (ci) => block.tableCols > 1 && onChange({ tableRows: rows.map(r => r.filter((_, i) => i !== ci)), tableCols: block.tableCols - 1 });

    return (
      <div className={`notion__block notion__block--table ${isSelected ? 'notion__block--selected' : ''}`}
        onClick={() => onSelect(block.id)}>
        <div className="notion__table-wrap">
          <table className="notion__table">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 && block.tableHasHeader ? 'notion__table-header-row' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="notion__table-cell">
                      <input
                        className="notion__table-input"
                        value={cell}
                        onChange={e => updateCell(ri, ci, e.target.value)}
                        placeholder={ri === 0 && block.tableHasHeader ? `Header ${ci + 1}` : ''}
                      />
                    </td>
                  ))}
                  <td className="notion__table-action-cell">
                    <button className="notion__table-action" onClick={() => removeRow(ri)} title="Remove row">×</button>
                  </td>
                </tr>
              ))}
              <tr>
                {rows[0]?.map((_, ci) => (
                  <td key={ci} className="notion__table-action-cell">
                    <button className="notion__table-action" onClick={() => removeCol(ci)} title="Remove col">×</button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="notion__table-controls">
          <button className="notion__table-add-btn" onClick={addRow}>+ ROW</button>
          <button className="notion__table-add-btn" onClick={addCol}>+ COL</button>
          <label className="notion__table-header-toggle">
            <input type="checkbox" checked={block.tableHasHeader} onChange={e => onChange({ tableHasHeader: e.target.checked })} />
            HEADER ROW
          </label>
        </div>
      </div>
    );
  }

  if (block.type === 'chart') {
    return (
      <div className={`notion__block notion__block--chart ${isSelected ? 'notion__block--selected' : ''}`}
        onClick={() => onSelect(block.id)}>
        <div className="notion__chart-container">
          {block.chartType === 'bar'  && <BarChart  labels={block.chartLabels} values={block.chartValues} title={block.chartTitle} />}
          {block.chartType === 'line' && <LineChart labels={block.chartLabels} values={block.chartValues} title={block.chartTitle} />}
          {block.chartType === 'pie'  && <PieChart  labels={block.chartLabels} values={block.chartValues} title={block.chartTitle} />}
          <button className="notion__chart-edit-btn" onClick={e => { e.stopPropagation(); onChartEdit(block.id); }}>
            EDIT CHART DATA
          </button>
        </div>
      </div>
    );
  }

  if (block.type === 'url') {
    return (
      <div className={`notion__block notion__block--url ${isSelected ? 'notion__block--selected' : ''}`}
        onClick={() => onSelect(block.id)}>
        {block.urlHref ? (
          <a href={block.urlHref} target="_blank" rel="noopener noreferrer" className="notion__url-card">
            <div className="notion__url-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 8a2 2 0 01-2-2V4a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2" stroke="currentColor" strokeWidth="1.3"/><path d="M10 8a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 012-2" stroke="currentColor" strokeWidth="1.3"/></svg>
            </div>
            <div className="notion__url-info">
              <span className="notion__url-title">{block.urlTitle || block.urlHref}</span>
              {block.urlDesc && <span className="notion__url-desc">{block.urlDesc}</span>}
              <span className="notion__url-href">{block.urlHref}</span>
            </div>
          </a>
        ) : (
          <button className="notion__url-empty" onClick={e => { e.stopPropagation(); onURLEdit(block.id); }}>
            + ADD URL / EMBED LINK
          </button>
        )}
        <button className="notion__url-edit-btn" onClick={e => { e.stopPropagation(); onURLEdit(block.id); }}>EDIT</button>
      </div>
    );
  }

  // Text-based blocks
  const tagMap = { h1: 'h1', h2: 'h2', h3: 'h3', paragraph: 'p', quote: 'blockquote', bullet: 'li', numbered: 'li' };
  const Tag = tagMap[block.type] || 'p';
  const className = `notion__block notion__block--${block.type} ${isSelected ? 'notion__block--selected' : ''}`;

  return (
    <div className={className} onClick={() => onSelect(block.id)}>
      {block.type === 'bullet' && <span className="notion__bullet-dot">•</span>}
      {block.type === 'numbered' && <span className="notion__numbered-dot">1.</span>}
      <div
        ref={ref}
        className={`notion__editable notion__editable--${block.type}`}
        contentEditable
        suppressContentEditableWarning
        style={style}
        onInput={handleInput}
        onKeyDown={handleKeyDownLocal}
        onFocus={() => onSelect(block.id)}
        data-placeholder={
          block.type === 'h1' ? 'Heading 1' :
          block.type === 'h2' ? 'Heading 2' :
          block.type === 'h3' ? 'Heading 3' :
          block.type === 'quote' ? 'Quotation...' :
          block.type === 'bullet' ? 'List item' :
          block.type === 'numbered' ? 'List item' :
          'Type something...'
        }
      />
    </div>
  );
});

// ── Toolbar ──────────────────────────────────────────────────────────
function Toolbar({ selectedBlock, onChange, onInsert, onDelete, onMoveUp, onMoveDown }) {
  const [showTextColors, setShowTextColors] = useState(false);
  const [showBgColors, setShowBgColors] = useState(false);
  const [showBlockType, setShowBlockType] = useState(false);

  if (!selectedBlock) return (
    <div className="notion__toolbar">
      <span className="notion__toolbar-hint">SELECT A BLOCK TO EDIT</span>
      <div className="notion__toolbar-spacer" />
      <div className="notion__insert-group">
        {[
          { type: 'paragraph', label: '¶ TEXT', tooltip: 'Insert Text' },
          { type: 'h1', label: 'H1', tooltip: 'Insert Heading 1' },
          { type: 'h2', label: 'H2', tooltip: 'Insert Heading 2' },
          { type: 'table', label: '⊞ TABLE', tooltip: 'Insert Table' },
          { type: 'code', label: '</> CODE', tooltip: 'Insert Code Block' },
          { type: 'chart', label: '▦ CHART', tooltip: 'Insert Chart' },
          { type: 'divider', label: '— DIVIDER', tooltip: 'Insert Divider' },
          { type: 'url', label: '⬡ URL', tooltip: 'Embed URL' },
        ].map(b => (
          <button key={b.type} className="notion__tool" data-tooltip={b.tooltip} onClick={() => onInsert(b.type)}>{b.label}</button>
        ))}
      </div>
    </div>
  );

  const b = selectedBlock;
  const isText = ['paragraph','h1','h2','h3','quote','bullet','numbered'].includes(b.type);

  const BLOCK_TYPES = [
    { type: 'paragraph', label: 'Paragraph' }, { type: 'h1', label: 'Heading 1' },
    { type: 'h2', label: 'Heading 2' },         { type: 'h3', label: 'Heading 3' },
    { type: 'quote', label: 'Quote' },          { type: 'bullet', label: 'Bullet List' },
    { type: 'numbered', label: 'Numbered List' },
  ];

  return (
    <div className="notion__toolbar">
      {/* Block type */}
      <div className="notion__toolbar-group notion__toolbar-group--dropdown" style={{ position: 'relative' }}>
        <button className="notion__tool notion__tool--type" data-tooltip="Change Block Type" onClick={() => setShowBlockType(v => !v)}>
          {b.type.toUpperCase().replace('_', ' ')} ▾
        </button>
        {showBlockType && (
          <div className="notion__dropdown" style={{ top: '100%', left: 0 }}>
            {BLOCK_TYPES.map(t => (
              <button key={t.type} className="notion__dropdown-item"
                onClick={() => { onChange({ type: t.type }); setShowBlockType(false); }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="notion__toolbar-sep" />

      {/* Text formatting */}
      {isText && (
        <>
          <div className="notion__toolbar-group">
            <button className={`notion__tool notion__tool--fmt ${b.bold ? 'notion__tool--active' : ''}`}
              data-tooltip="Bold" onClick={() => onChange({ bold: !b.bold })}><b>B</b></button>
            <button className={`notion__tool notion__tool--fmt ${b.italic ? 'notion__tool--active' : ''}`}
              data-tooltip="Italic" onClick={() => onChange({ italic: !b.italic })}><i>I</i></button>
            <button className={`notion__tool notion__tool--fmt ${b.underline ? 'notion__tool--active' : ''}`}
              data-tooltip="Underline" onClick={() => onChange({ underline: !b.underline })}><u>U</u></button>
          </div>
          <div className="notion__toolbar-sep" />
          {/* Alignment */}
          <div className="notion__toolbar-group">
            {['left','center','right'].map(a => (
              <button key={a} className={`notion__tool ${b.align === a ? 'notion__tool--active' : ''}`}
                data-tooltip={`Align ${a.charAt(0).toUpperCase() + a.slice(1)}`} onClick={() => onChange({ align: a })}>
                {a === 'left' ? '≡' : a === 'center' ? '≡̄' : '≡→'}
              </button>
            ))}
          </div>
          <div className="notion__toolbar-sep" />
          {/* Text color */}
          <div className="notion__toolbar-group" style={{ position: 'relative' }}>
            <button className="notion__tool notion__tool--color" data-tooltip="Text Color" onClick={() => { setShowTextColors(v => !v); setShowBgColors(false); }}>
              <span style={{ borderBottom: `3px solid ${b.color !== 'inherit' ? b.color : '#0D0D0D'}` }}>A</span> TXT ▾
            </button>
            {showTextColors && (
              <div className="notion__color-picker">
                {TEXT_COLORS.map(c => (
                  <button key={c.value} className="notion__color-btn"
                    style={{ background: c.value === 'inherit' ? '#F5F4F0' : c.value, border: b.color === c.value ? '2px solid #0D0D0D' : '2px solid transparent' }}
                    onClick={() => { onChange({ color: c.value }); setShowTextColors(false); }}
                    title={c.label} />
                ))}
              </div>
            )}
          </div>
          {/* Background color */}
          <div className="notion__toolbar-group" style={{ position: 'relative' }}>
            <button className="notion__tool notion__tool--color" data-tooltip="Background Color" onClick={() => { setShowBgColors(v => !v); setShowTextColors(false); }}>
              <span style={{ background: b.bgColor !== 'transparent' ? b.bgColor : 'transparent', padding: '0 3px' }}>A</span> BG ▾
            </button>
            {showBgColors && (
              <div className="notion__color-picker">
                {BG_COLORS.map(c => (
                  <button key={c.value} className="notion__color-btn"
                    style={{ background: c.value === 'transparent' ? '#F5F4F0' : c.value, border: b.bgColor === c.value ? '2px solid #0D0D0D' : '2px solid transparent' }}
                    onClick={() => { onChange({ bgColor: c.value }); setShowBgColors(false); }}
                    title={c.label} />
                ))}
              </div>
            )}
          </div>
          <div className="notion__toolbar-sep" />
        </>
      )}

      {/* Insert */}
      <div className="notion__toolbar-group">
        {[
          { type: 'paragraph', label: '¶', tooltip: 'Insert Text' }, 
          { type: 'table', label: '⊞', tooltip: 'Insert Table' },
          { type: 'code', label: '</>', tooltip: 'Insert Code' }, 
          { type: 'chart', label: '▦', tooltip: 'Insert Chart' },
          { type: 'divider', label: '—', tooltip: 'Insert Divider' }, 
          { type: 'url', label: '⬡', tooltip: 'Embed URL' },
        ].map(b => <button key={b.type} className="notion__tool" data-tooltip={b.tooltip} onClick={() => onInsert(b.type)}>{b.label}</button>)}
      </div>

      <div className="notion__toolbar-sep" />

      {/* Move & Delete */}
      <div className="notion__toolbar-group">
        <button className="notion__tool" data-tooltip="Move Up" onClick={onMoveUp}>↑</button>
        <button className="notion__tool" data-tooltip="Move Down" onClick={onMoveDown}>↓</button>
        <button className="notion__tool notion__tool--danger" data-tooltip="Delete Block" onClick={onDelete}>⌫</button>
      </div>

      <div className="notion__toolbar-spacer" />
      <div className="notion__live-indicator"><span className="notion__live-dot" />LIVE</div>
    </div>
  );
}

// ── Page Component ───────────────────────────────────────────────────
function NotionPage({ page, pageIdx, totalPages, selectedBlockId, onSelectBlock, onBlockChange, onAddBlock, onDeleteBlock, onMoveBlock, onChartEdit, onURLEdit, onDeletePage, onDuplicatePage }) {
  return (
    <div className="notion__page">
      <div className="notion__page-inner">
        {page.blocks.map((block) => (
          <Block
            key={block.id}
            block={block}
            isSelected={selectedBlockId === block.id}
            onSelect={onSelectBlock}
            onChange={(updates) => onBlockChange(pageIdx, block.id, updates)}
            onAddAfter={() => onAddBlock(pageIdx, block.id)}
            onDelete={() => onDeleteBlock(pageIdx, block.id)}
            onChartEdit={onChartEdit}
            onURLEdit={onURLEdit}
          />
        ))}
        <button className="notion__add-block-btn" onClick={() => onAddBlock(pageIdx, null)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          ADD BLOCK
        </button>
      </div>
      <div className="notion__page-footer">
        <span className="notion__page-num">PAGE {pageIdx + 1} / {totalPages}</span>
        <div className="notion__page-footer-actions">
          <button className="notion__page-action" onClick={() => onDuplicatePage(pageIdx)}>DUPLICATE</button>
          {totalPages > 1 && <button className="notion__page-action notion__page-action--danger" onClick={() => onDeletePage(pageIdx)}>DELETE PAGE</button>}
        </div>
      </div>
    </div>
  );
}

// ── Main Notion Component ────────────────────────────────────────────
export default function Notion({ sessionTitle, onClose, addFile }) {
  const [pages, setPages] = useState([{
    id: 'page-1',
    blocks: [
      createBlock('h1', sessionTitle || 'Document Title'),
      createBlock('paragraph', ''),
    ],
  }]);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [docTitle, setDocTitle] = useState(sessionTitle || 'Untitled Document');
  const [showExport, setShowExport] = useState(false);
  const [chartModalBlockId, setChartModalBlockId] = useState(null);
  const [urlModalBlockId, setURLModalBlockId] = useState(null);

  // 줌 기능 상태 설정
  const [zoom, setZoom] = useState(1);
  const bodyRef = useRef(null);

  // 마우스 휠 이벤트 (줌인-아웃 5% 민감도로 설정)
  useEffect(() => {
    const bodyEl = bodyRef.current;
    if (!bodyEl) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(z => {
          // 0.1(10%) -> 0.05(5%)로 민감도 완화
          const newZoom = e.deltaY < 0 ? z + 0.05 : z - 0.05;
          return Math.min(Math.max(newZoom, 0.3), 3); // 최소 30%, 최대 300%
        });
      }
    };

    bodyEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => bodyEl.removeEventListener('wheel', handleWheel);
  }, []);

  // Find selected block across all pages
  const { block: selectedBlock, pageIdx: selectedPageIdx } = (() => {
    for (let pi = 0; pi < pages.length; pi++) {
      const b = pages[pi].blocks.find(b => b.id === selectedBlockId);
      if (b) return { block: b, pageIdx: pi };
    }
    return { block: null, pageIdx: -1 };
  })();

  const updateBlock = useCallback((pageIdx, blockId, updates) => {
    setPages(prev => prev.map((p, pi) =>
      pi !== pageIdx ? p : { ...p, blocks: p.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b) }
    ));
  }, []);

  const addBlockAfter = useCallback((pageIdx, afterBlockId) => {
    const newBlock = createBlock('paragraph', '');
    setPages(prev => prev.map((p, pi) => {
      if (pi !== pageIdx) return p;
      const idx = afterBlockId ? p.blocks.findIndex(b => b.id === afterBlockId) : p.blocks.length - 1;
      const blocks = [...p.blocks];
      blocks.splice(idx + 1, 0, newBlock);
      return { ...p, blocks };
    }));
    setTimeout(() => setSelectedBlockId(newBlock.id), 20);
  }, []);

  const insertBlock = useCallback((type) => {
    const newBlock = createBlock(type, '');
    setPages(prev => {
      const targetPageIdx = selectedPageIdx >= 0 ? selectedPageIdx : prev.length - 1;
      return prev.map((p, pi) => {
        if (pi !== targetPageIdx) return p;
        if (!selectedBlockId) return { ...p, blocks: [...p.blocks, newBlock] };
        const idx = p.blocks.findIndex(b => b.id === selectedBlockId);
        const blocks = [...p.blocks];
        blocks.splice(idx + 1, 0, newBlock);
        return { ...p, blocks };
      });
    });
    setTimeout(() => setSelectedBlockId(newBlock.id), 20);
  }, [selectedBlockId, selectedPageIdx]);

  const deleteBlock = useCallback((pageIdx, blockId) => {
    setPages(prev => prev.map((p, pi) => {
      if (pi !== pageIdx) return p;
      const filtered = p.blocks.filter(b => b.id !== blockId);
      return { ...p, blocks: filtered.length ? filtered : [createBlock('paragraph', '')] };
    }));
    setSelectedBlockId(null);
  }, []);

  const moveBlock = useCallback((pageIdx, blockId, dir) => {
    setPages(prev => prev.map((p, pi) => {
      if (pi !== pageIdx) return p;
      const idx = p.blocks.findIndex(b => b.id === blockId);
      const newIdx = idx + (dir === 'up' ? -1 : 1);
      if (newIdx < 0 || newIdx >= p.blocks.length) return p;
      const blocks = [...p.blocks];
      [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
      return { ...p, blocks };
    }));
  }, []);

  const addPage = () => {
    setPages(prev => [...prev, {
      id: `page-${Date.now()}`,
      blocks: [createBlock('paragraph', '')],
    }]);
  };

  const deletePage = (idx) => {
    setPages(prev => prev.filter((_, i) => i !== idx));
    setSelectedBlockId(null);
  };

  const duplicatePage = (idx) => {
    const newPage = {
      id: `page-${Date.now()}`,
      blocks: pages[idx].blocks.map(b => ({ ...b, id: `b${_blockId++}` })),
    };
    setPages(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, newPage);
      return next;
    });
  };

  const wordCount = pages.flatMap(p => p.blocks).map(b => b.content || '').join(' ').split(/\s+/).filter(Boolean).length;

  const chartModalBlock = chartModalBlockId ? pages.flatMap(p => p.blocks).find(b => b.id === chartModalBlockId) : null;
  const urlModalBlock = urlModalBlockId ? pages.flatMap(p => p.blocks).find(b => b.id === urlModalBlockId) : null;

  return (
    <>
      <div className="notion-overlay" onClick={onClose}>
        <div className="notion-modal" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="notion__header">
            <div className="notion__header-left">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="14" height="14" rx="2" stroke="var(--green)" strokeWidth="1.5"/>
                <path d="M5 6h8M5 9h8M5 12h5" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input className="notion__doc-title" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
            </div>
            <div className="notion__header-right">
              <span className="notion__header-meta">{wordCount} WORDS · {pages.length} PAGE{pages.length > 1 ? 'S' : ''}</span>
              <button className="notion__export-btn" onClick={() => setShowExport(true)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                EXPORT
              </button>
              <button className="notion__close" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <Toolbar
            selectedBlock={selectedBlock}
            onChange={(updates) => selectedBlock && updateBlock(selectedPageIdx, selectedBlock.id, updates)}
            onInsert={insertBlock}
            onDelete={() => selectedBlock && deleteBlock(selectedPageIdx, selectedBlock.id)}
            onMoveUp={() => selectedBlock && moveBlock(selectedPageIdx, selectedBlock.id, 'up')}
            onMoveDown={() => selectedBlock && moveBlock(selectedPageIdx, selectedBlock.id, 'down')}
          />

          {/* Pages */}
          <div className="notion__body" ref={bodyRef}>
            <div 
              className="notion__pages-container"
              style={{ 
                transform: `scale(${zoom})`, 
                transformOrigin: 'top center', 
                transition: 'transform 0.1s ease-out' 
              }}
            >
              {pages.map((page, pi) => (
                <React.Fragment key={page.id}>
                  <NotionPage
                    page={page} pageIdx={pi} totalPages={pages.length}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={setSelectedBlockId}
                    onBlockChange={updateBlock}
                    onAddBlock={addBlockAfter}
                    onDeleteBlock={deleteBlock}
                    onMoveBlock={moveBlock}
                    onChartEdit={setChartModalBlockId}
                    onURLEdit={setURLModalBlockId}
                    onDeletePage={deletePage}
                    onDuplicatePage={duplicatePage}
                  />
                  {pi < pages.length - 1 && <div className="notion__page-break">PAGE BREAK</div>}
                </React.Fragment>
              ))}
              <button className="notion__add-page-btn" onClick={addPage}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                ADD NEW PAGE
              </button>
            </div>
          </div>

          {/* ── 하단 줌(Zoom) 컨트롤 ── */}
          <div className="notion__zoom-controls">
            <span className="notion__zoom-icon" data-tooltip="Zoom Ctrl + Wheel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2l-3 3"/>
                <path d="M2 22l3-3"/>
                <path d="M11 15l4-4"/>
                <path d="M15 11l4-4 3 3-4 4-3-3z"/>
                <path d="M5 19l4-4 3 3-4 4-3-3z"/>
                <path d="M8 12l4-4"/>
              </svg>
            </span>
            <button className="notion__zoom-btn" onClick={() => setZoom(z => Math.max(z - 0.05, 0.3))}>-</button>
            <span className="notion__zoom-level">{Math.round(zoom * 100)}%</span>
            <button className="notion__zoom-btn" onClick={() => setZoom(z => Math.min(z + 0.05, 3))}>+</button>
          </div>

        </div>
      </div>

      {/* Modals */}
      {showExport && <ExportModal pages={pages} title={docTitle} onClose={() => setShowExport(false)} />}
      {chartModalBlock && (
        <ChartModal
          block={chartModalBlock}
          onSave={(updates) => {
            const pi = pages.findIndex(p => p.blocks.some(b => b.id === chartModalBlockId));
            if (pi >= 0) updateBlock(pi, chartModalBlockId, updates);
            setChartModalBlockId(null);
          }}
          onClose={() => setChartModalBlockId(null)}
        />
      )}
      {urlModalBlock && (
        <URLModal
          block={urlModalBlock}
          onSave={(updates) => {
            const pi = pages.findIndex(p => p.blocks.some(b => b.id === urlModalBlockId));
            if (pi >= 0) updateBlock(pi, urlModalBlockId, updates);
            setURLModalBlockId(null);
          }}
          onClose={() => setURLModalBlockId(null)}
        />
      )}
    </>
  );
}