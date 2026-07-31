'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Profile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { displayNameOf } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Checkbox } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // matches the bucket's file_size_limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function ProfileEditor({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    display_name: profile.display_name ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    website: profile.website ?? '',
    is_public: profile.is_public,
    show_goals_publicly: profile.show_goals_publicly,
  });
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function uploadAvatar(file: File) {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Avatars must be a JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('That image is over 2 MB. Try a smaller one.');
      return;
    }

    setUploading(true);

    // `{user_id}/avatar.{ext}` — the folder name is what the storage RLS
    // policy checks, and the fixed filename means re-uploads replace rather
    // than accumulate.
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${profile.id}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path);

    // Cache-bust: the path is stable, so browsers would keep the old image.
    const busted = `${publicUrl}?v=${Date.now()}`;

    const { error: saveError } = await supabase
      .from('profiles')
      .update({ avatar_url: busted })
      .eq('id', profile.id);

    if (saveError) {
      setError(saveError.message);
      setUploading(false);
      return;
    }

    setAvatarUrl(busted);
    setUploading(false);
    router.refresh();
  }

  async function removeAvatar() {
    setUploading(true);
    setError(null);

    const { error: saveError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', profile.id);

    if (saveError) setError(saveError.message);
    else setAvatarUrl(null);

    setUploading(false);
    router.refresh();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        display_name: form.display_name.trim() || null,
        bio: form.bio.trim() || null,
        location: form.location.trim() || null,
        website: form.website.trim() || null,
        is_public: form.is_public,
        show_goals_publicly: form.show_goals_publicly,
      })
      .eq('id', profile.id);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form className="stack-lg" onSubmit={onSubmit}>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Profile saved.</Alert>}

      <div className="avatar-upload">
        <Avatar name={displayNameOf({ display_name: form.display_name })} url={avatarUrl} size={72} />
        <div className="stack-sm">
          <input
            ref={fileInput}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
              event.target.value = '';
            }}
          />
          <div className="row wrap">
            <Button
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {avatarUrl ? 'Replace photo' : 'Upload photo'}
            </Button>
            {avatarUrl && (
              <Button variant="danger" size="sm" onClick={removeAvatar} disabled={uploading}>
                Remove
              </Button>
            )}
          </div>
          <span className="field__hint">JPEG, PNG, WebP, or GIF. Up to 2 MB.</span>
        </div>
      </div>

      <Input
        label="Display name"
        maxLength={80}
        value={form.display_name}
        onChange={(e) => update('display_name', e.target.value)}
      />

      <Textarea
        label="Bio"
        rows={5}
        maxLength={1000}
        value={form.bio}
        placeholder="What brought you here?"
        onChange={(e) => update('bio', e.target.value)}
      />

      <div className="grid grid--2">
        <Input
          label="Location"
          maxLength={120}
          value={form.location}
          placeholder="Asheville, NC"
          onChange={(e) => update('location', e.target.value)}
        />
        <Input
          label="Website"
          maxLength={200}
          value={form.website}
          placeholder="yoursite.com"
          onChange={(e) => update('website', e.target.value)}
        />
      </div>

      <div className="stack-sm">
        <Checkbox
          label="Show my profile in the community"
          description="Other members can find you in the directory and open your profile."
          checked={form.is_public}
          onChange={(e) => update('is_public', e.target.checked)}
        />
        <Checkbox
          label="Show my goals on my profile"
          description="Your ten are visible to anyone who can see your profile."
          checked={form.show_goals_publicly}
          disabled={!form.is_public}
          onChange={(e) => update('show_goals_publicly', e.target.checked)}
        />
      </div>

      <div className="row wrap">
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
        <Link className="btn btn--secondary" href={`/profile/${profile.id}`}>
          View public profile
        </Link>
      </div>
    </form>
  );
}
