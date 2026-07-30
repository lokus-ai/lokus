import { Textarea, Label } from 'lokus';

export const Default = () => (
  <div style={{ maxWidth: 460 }}>
    <Textarea
      defaultValue={
        '## Weekly Review\n\n- Shipped manifest-based sync (V2)\n- [[Graph View]] still slow above 5k nodes\n- Next: trash cleanup job'
      }
      rows={5}
    />
  </div>
);

export const WithPlaceholder = () => (
  <div style={{ maxWidth: 460 }}>
    <Textarea placeholder="Write a note… Markdown and [[wiki links]] supported." rows={5} />
  </div>
);

export const WithLabel = () => (
  <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <Label htmlFor="template-body">Template body</Label>
    <Textarea
      id="template-body"
      defaultValue={'# {{title}}\n\nCreated: {{date}}\nTags: #journal\nLinks: [[Weekly Review]]'}
      rows={5}
    />
  </div>
);

export const Disabled = () => (
  <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <Label htmlFor="conflict-body">Remote version (read-only)</Label>
    <Textarea
      id="conflict-body"
      disabled
      defaultValue={
        'Design/Canvas Spec.md\n\nLast edited on another device 6 minutes ago.\nResolve the conflict to enable editing.'
      }
      rows={4}
    />
  </div>
);
