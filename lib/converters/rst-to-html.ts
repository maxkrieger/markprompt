// Adapted from: https://github.com/thoward/rst2html
import restructured from 'restructured';

export const rstToHTML = (content: string, indent = 2) => {
  const parsedRST = restructured.parse(content);
  return renderNode(parsedRST, 0, indent);
};

const renderNode = (element: any, level = 0, indent = 2) => {
  switch (element.type) {
    case 'document':
      return renderDocument(element, level, indent);
    case 'section':
      return renderSection(element, level, indent);
    case 'transition':
      return renderTransition(element, level, indent);
    case 'paragraph':
      return renderParagraph(element, level, indent);
    case 'bullet_list':
      return renderBulletList(element, level, indent);
    case 'enumerated_list':
      return renderEnumeratedList(element, level, indent);
    case 'definition_list':
      return renderDefinitionList(element, level, indent);
    case 'list_item':
      return renderListItem(element, level, indent);
    case 'line':
      return renderLine(element, level, indent);
    case 'line_block':
      return renderLineBlock(element, level, indent);
    case 'literal_block':
      return renderLiteralBlock(element, level, indent);
    case 'block_quote':
      return renderBlockQuote(element, level, indent);
    case 'interpreted_text':
      return renderInterpretedText(element, level, indent);
    case 'text':
      return renderText(element, level, indent);
    case 'emphasis':
      return renderEmphasis(element, level, indent);
    case 'strong':
      return renderStrong(element, level, indent);
    case 'literal':
      return renderLiteral(element, level, indent);
    default:
      return renderUnknown(element, level, indent);
  }
};

const renderUnknown = (element: any, level = 0, indent = 2) => {
  if (element.children) {
    return renderBlock_element(
      'div',
      `rst-unknown rst-${element.type}`,
      element,
      level,
      indent,
    );
  } else {
    return renderLeafElement(
      'div',
      `rst-unknown rst-${element.type}`,
      element,
      level,
      indent,
    );
  }
};

const renderDocument = (element: any, level = 0, indent = 2) => {
  return renderBlock_element('div', 'rst-document', element, level, indent);
};

const renderSection = (element: any, level = 0, indent = 2) => {
  const indentString = ' '.repeat(level * indent);

  const title = renderTitle(
    element.depth,
    element.children[0],
    level + 1,
    indent,
  );

  const children = element.children
    .slice(1)
    .map((e: any) => renderNode(e, level + 1, indent))
    .join('\n');

  return `${indentString}<div class="rst-section">\n${title}${children}${indentString}</div>\n`;
};

const renderTitle = (depth: number, element: any, level = 0, indent = 2) => {
  const titleTag = `h${depth}`;
  const titleClassName = `rst-title-${depth}`;

  return renderBlock_element(titleTag, titleClassName, element, level, indent);
};

const renderTransition = (element: any, level = 0, indent = 2) => {
  // TODO: implement transitions
  return renderUnknown(element, level, indent);
};

const renderParagraph = (element: any, level = 0, indent = 2) => {
  return renderBlock_element('p', 'rst-paragraph', element, level, indent);
};

const renderBulletList = (element: any, level = 0, indent = 2) => {
  return renderBlock_element('ul', 'rst-bullet-list', element, level, indent);
};

const renderEnumeratedList = (element: any, level = 0, indent = 2) => {
  return renderBlock_element(
    'ol',
    'rst-enumerated-list',
    element,
    level,
    indent,
  );
};

const renderDefinitionList = (element: any, level = 0, indent = 2) => {
  // TODO: implement definition lists
  return renderUnknown(element, level, indent);
};

const renderListItem = (element: any, level = 0, indent = 2) => {
  return renderBlock_element('li', 'rst-list-item', element, level, indent);
};

const renderLine = (element: any, level = 0, indent = 2) => {
  return renderBlock_element('div', 'rst-line', element, level, indent);
};

const renderLineBlock = (element: any, level = 0, indent = 2) => {
  return renderBlock_element('div', 'rst-line-block', element, level, indent);
};

const renderLiteralBlock = (element: any, level = 0, indent = 2) => {
  return renderBlock_element(
    'pre',
    'rst-literal-block',
    element,
    level,
    indent,
  );
};

const renderBlockQuote = (element: any, level = 0, indent = 2) => {
  return renderBlock_element(
    'blockquote',
    'rst-block-quote',
    element,
    level,
    indent,
  );
};

const renderText = (element: any, level = 0, indent = 2) => {
  return renderLeafElement('span', 'rst-text', element, level, indent);
};

const renderInterpretedText = (element: any, level = 0, indent = 2) => {
  const className =
    'rst-interpreted_text' + (element.role ? ` rst-role-${element.role}` : '');
  return renderInlineElement('span', className, element, level, indent);
};

const renderEmphasis = (element: any, level = 0, indent = 2) => {
  return renderInlineElement('em', 'rst-emphasis', element, level, indent);
};

const renderStrong = (element: any, level = 0, indent = 2) => {
  return renderInlineElement('strong', 'rst-strong', element, level, indent);
};

const renderLiteral = (element: any, level = 0, indent = 2) => {
  return renderInlineElement('tt', 'rst-literal', element, level, indent);
};

const renderLeafElement = (
  tag: string,
  className: string,
  element: any,
  _level = 0,
  _indent = 2,
) => {
  return `<${tag} class="${className}">${element.value.replace(
    /\n$/,
    '',
  )}</${tag}>`;
};

const renderInlineElement = (
  tag: string,
  className: string,
  element: any,
  level = 0,
  indent = 2,
) => {
  const children = element.children
    .map((e: any) => renderNode(e, level + 1, indent))
    .join('');
  return `<${tag} class="${className}">${children}</${tag}>`;
};

const renderBlock_element = (
  tag: string,
  className: string,
  element: any,
  level = 0,
  indent = 2,
) => {
  const indentString = ' '.repeat(level * indent);
  const children = element.children
    .map((e: any) => renderNode(e, level + 1, indent))
    .join('');

  return `${indentString}<${tag} class="${className}">\n${children}\n${indentString}</${tag}>\n`;
};
