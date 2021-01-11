import * as React from 'react';
import { StoryRow } from './StoryRow';
import { LabeledInput } from './LabeledInput';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/elements', module).add('LabeledInput', () => {
  const child = text('label', 'foo bar');
  const placeholder = text('placeholder', 'foo bar');
  const [value, setValue] = React.useState('');

  return (
    <StoryRow>
      <LabeledInput value={value} onChange={setValue} placeholder={placeholder}>
        {child}
      </LabeledInput>
    </StoryRow>
  );
});
