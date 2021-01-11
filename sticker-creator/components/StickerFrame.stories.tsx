import * as React from 'react';
import { StoryRow } from '../elements/StoryRow';
import { StickerFrame } from './StickerFrame';

import { storiesOf } from '@storybook/react';
import { boolean, select, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

storiesOf('Sticker Creator/components', module).add('StickerFrame', () => {
  const image = text('image url', '/fixtures/512x515-thumbs-up-lincoln.webp');
  const showGuide = boolean('show guide', true);
  const mode = select('mode', [null, 'removable', 'pick-emoji', 'add'], null);
  const onRemove = action('onRemove');
  const onDrop = action('onDrop');
  const [skinTone, setSkinTone] = React.useState(0);
  const [emoji, setEmoji] = React.useState(undefined);

  return (
    <StoryRow top={true}>
      <StickerFrame
        id="1337"
        emojiData={emoji}
        image={image}
        mode={mode}
        showGuide={showGuide}
        onRemove={onRemove}
        skinTone={skinTone}
        onSetSkinTone={setSkinTone}
        onPickEmoji={e => setEmoji(e.emoji)}
        onDrop={onDrop}
      />
    </StoryRow>
  );
});
