// Read-only regression gate for the migrated CMS content and existing articles.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { webflow, postFields, sameFields } from './migrate-webflow-cms.mjs';

const work = new URL('../.secrets/webflow-migration/', import.meta.url);
const snapshots = (await fs.readdir(work)).filter(f => /^cms-before-\d+\.json$/.test(f)).sort();
assert.ok(snapshots.length, 'Original CMS snapshot required');
const baseline = JSON.parse(await fs.readFile(new URL(snapshots[0], work), 'utf8'));
const assets = JSON.parse(await fs.readFile(new URL('assets.json', work), 'utf8'));
const collections = await webflow(['cms', 'collections', 'list', '--site', '69b9ae3792be3b49ef7eab96']);
async function items(id) {
  const result = await webflow(['cms', 'items', 'list', '--collection', id]);
  const rows = Array.isArray(result) ? result : result.items;
  assert.ok(Array.isArray(rows) && rows.length < 100 && !(result.total > rows.length), 'Complete item listing required');
  return rows;
}
const counts = { verifiedNewDrafts: 0, unchangedExistingArticles: 0, verifiedCategoryDrafts: 0 };
for (const group of baseline.groups) {
  const categoryCollection = collections.find(c => c.slug === group.slug);
  assert.ok(categoryCollection, 'Missing destination category collection');
  const [posts, categories, schema] = await Promise.all([
    items(group.target), items(categoryCollection.id),
    webflow(['cms', 'collections', 'get', group.target]),
  ]);
  const reference = schema.fields.find(f => f.slug === 'category');
  assert.equal(reference?.type, 'Reference');
  assert.equal(reference.validations?.collectionId, categoryCollection.id);
  assert.equal(reference.isRequired, false);
  const categoryMap = {};
  for (const source of group.sourceCategories) {
    const target = categories.find(c => c.fieldData.slug === source.fieldData.slug);
    assert.ok(target, 'Missing category');
    assert.equal(target.fieldData.name, source.fieldData.name);
    assert.equal(target.isDraft, true);
    categoryMap[source.id] = target.id;
    counts.verifiedCategoryDrafts++;
  }
  for (const original of group.targetItems) {
    const current = posts.find(p => p.id === original.id);
    assert.ok(current, 'Original destination article missing');
    const fields = { ...current.fieldData };
    if (!Object.hasOwn(original.fieldData, 'category')) {
      assert.equal(fields.category, null);
      delete fields.category;
    }
    assert.deepEqual(fields, original.fieldData);
    assert.equal(current.isDraft, original.isDraft);
    assert.equal(current.isArchived, original.isArchived);
    counts.unchangedExistingArticles++;
  }
  for (const current of posts.filter(p => !group.targetItems.some(i => i.id === p.id))) {
    const source = group.sourceItems.find(p => p.fieldData.slug === current.fieldData.slug);
    assert.ok(source, 'Unrecognized new destination article; review before proceeding');
    assert.equal(current.isDraft, true);
    assert.equal(await sameFields(current.fieldData, postFields(source.fieldData, categoryMap, assets)), true);
    counts.verifiedNewDrafts++;
  }
}
assert.deepEqual(counts, { verifiedNewDrafts: 12, unchangedExistingArticles: 3, verifiedCategoryDrafts: 8 });
console.log(JSON.stringify(counts));
