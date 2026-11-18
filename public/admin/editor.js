/* Decap CMS is deliberately pinned in index.html. No credentials belong here. */
(function () {
  'use strict';

  const status = document.getElementById('editor-status');

  if (!window.CMS) {
    status.innerHTML = '<h1>The editor could not load</h1><p>Check your internet connection, then refresh this page.</p><p><a href="/">Return to the portfolio</a></p>';
    return;
  }

  window.CMS.registerPreviewStyle('/admin/preview.css');
  window.CMS.registerPreviewTemplate('posts', function PostPreview(props) {
    const data = props.entry.get('data');
    const date = data.get('date');
    const dateLabel = date instanceof Date
      ? date.toISOString().slice(0, 10)
      : String(date || '').slice(0, 10);
    const tags = data.get('tags');
    const tagList = tags && typeof tags.toArray === 'function' ? tags.toArray() : (Array.isArray(tags) ? tags : []);

    return window.h('article', { className: 'post-preview' },
      window.h('p', { className: 'post-eyebrow' }, data.get('draft') !== false ? 'Draft · Only visible in the editor' : `${data.get('category') || 'Notes'} · Elijah Mwangi`),
      window.h('h1', {}, data.get('title') || 'Untitled article'),
      window.h('p', { className: 'post-description' }, data.get('description') || ''),
      window.h('p', { className: 'post-meta' }, [dateLabel, tagList.join(' · ')].filter(Boolean).join(' / ')),
      data.get('cover') ? window.h('img', { src: props.getAsset(data.get('cover')).toString(), alt: data.get('coverAlt') || '', style: { width: '100%', borderRadius: '10px', marginBottom: '24px' } }) : null,
      window.h('div', { className: 'post-body' }, props.widgetFor('body'))
    );
  });

  status.remove();
  window.CMS.init();
}());
