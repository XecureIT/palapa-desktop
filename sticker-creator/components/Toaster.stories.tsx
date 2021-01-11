import * as React from 'react';
import { debounce, dropRight } from 'lodash';
import { StoryRow } from '../elements/StoryRow';
import { Toaster } from './Toaster';

import { storiesOf } from '@storybook/react';
import { text as textKnob } from '@storybook/addon-knobs';

storiesOf('Sticker Creator/components', module).add('Toaster', () => {
  const inputText = textKnob('Slices', ['error 1', 'error 2'].join('|'));
  const initialState = React.useMemo(() => inputText.split('|'), [inputText]);
  const [state, setState] = React.useState(initialState);

  const handleDismiss = React.useCallback(
    // Debounce is required here since auto-dismiss is asynchronously called
    // from multiple rendered instances (multiple themes)
    debounce(() => {
      setState(dropRight);
    }, 10),
    [setState]
  );

  return (
    <StoryRow>
      <Toaster
        loaf={state.map((text, id) => ({ id, text }))}
        onDismiss={handleDismiss}
      />
    </StoryRow>
  );
});
