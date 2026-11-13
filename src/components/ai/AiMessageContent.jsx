import React from 'react';
import { Link } from 'react-router-dom';
import { parseAiMessage, tokenizeAiMessage } from './aiMessageFormat';

const Inline = ({ text }) => tokenizeAiMessage(text).map((token, index) => {
  if (token.type === 'link') {
    return <Link className="ap-ai__inline-link" to={token.to} key={index}>{token.label}</Link>;
  }
  if (token.type === 'bold') return <strong key={index}>{token.value}</strong>;
  return <React.Fragment key={index}>{token.value}</React.Fragment>;
});

/**
 * Assistant answers: light Markdown (paragraphs, lists, tables, bold).
 * User messages: plain text exactly as typed. Model HTML is never rendered.
 */
export default function AiMessageContent({ content, plain = false }) {
  if (plain) return <p className="ap-ai__plain">{String(content ?? '')}</p>;

  return parseAiMessage(content).map((block, index) => {
    if (block.type === 'ul' || block.type === 'ol') {
      const List = block.type;
      return (
        <List className="ap-ai__list" key={index}>
          {block.items.map((item, i) => <li key={i}><Inline text={item} /></li>)}
        </List>
      );
    }
    if (block.type === 'table') {
      return (
        <div className="ap-ai__table-wrap" key={index}>
          <table className="ap-ai__table">
            <thead><tr>{block.head.map((cell, i) => <th key={i} scope="col"><Inline text={cell} /></th>)}</tr></thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>{block.head.map((_, c) => <td key={c}><Inline text={row[c] ?? ''} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (block.type === 'heading') return <p className="ap-ai__para ap-ai__para--lead" key={index}><Inline text={block.text} /></p>;
    return <p className="ap-ai__para" key={index}><Inline text={block.text} /></p>;
  });
}
