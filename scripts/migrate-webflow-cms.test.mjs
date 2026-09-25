import test from 'node:test';
import assert from 'node:assert/strict';
import { remapImage, postFields, sameFields } from './migrate-webflow-cms.mjs';

const assets = { original: { status: 'verified', targetId: 'copied',
  sourceUrl: 'https://example.com/source/image.png', targetUrl: 'https://example.com/target/image.png' } };

test('uses target asset IDs and preserves image alt text', () => {
  assert.deepEqual(remapImage({ fileId: 'original', alt: 'Portrait' }, assets), {
    fileId: 'copied', url: assets.original.targetUrl, alt: 'Portrait',
  });
  assert.throws(() => remapImage({ fileId: 'missing' }, assets), /Unmapped source image/);
});

test('accepts CMS image rehosting only when bytes and surrounding content match', async () => {
  const expected = { 'main-image': { fileId: 'source', url: 'source', alt: 'Portrait' },
    'post-body': '<p>Keep text</p><img src="source" alt="Portrait">' };
  const actual = { 'main-image': { fileId: 'copy', url: 'copy', alt: 'Portrait' },
    'post-body': '<p>Keep text</p><img src="copy" alt="Portrait">' };
  const fingerprint = async url => url === 'changed' ? 'different-bytes' : 'identical-bytes';
  assert.equal(await sameFields(actual, expected, fingerprint), true);
  assert.equal(await sameFields({ ...actual, 'post-body': actual['post-body'].replace('Keep text', 'Lost text') }, expected, fingerprint), false);
  assert.equal(await sameFields({ ...actual, 'main-image': { ...actual['main-image'], url: 'changed' } }, expected, fingerprint), false);
  assert.equal(await sameFields({ ...actual, 'main-image': { ...actual['main-image'], alt: 'Changed' } }, expected, fingerprint), false);
});

test('maps category and main image while preserving content and false values', () => {
  const source = { name: 'Article', slug: 'article', featured: false,
    'post-summary': '', 'post-body': `<p>Text</p><img src="${assets.original.sourceUrl}">`,
    category: 'old-category', 'featured-image': { fileId: 'original' } };
  const original = structuredClone(source);
  const result = postFields(source, { 'old-category': 'new-category' }, assets);
  assert.equal(result.category, 'new-category');
  assert.equal(result['main-image'].fileId, 'copied');
  assert.equal(result.featured, false);
  assert.equal(result['post-summary'], '');
  assert.equal(result['post-body'], `<p>Text</p><img src="${assets.original.targetUrl}">`);
  assert.equal(result['featured-image'], undefined);
  assert.deepEqual(source, original);
  assert.throws(() => postFields(source, {}, assets), /Unmapped category/);
});
