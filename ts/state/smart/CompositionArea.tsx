import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { get } from 'lodash';
import { mapDispatchToProps } from '../actions';
import { CompositionArea } from '../../components/CompositionArea';
import { StateType } from '../reducer';

import { isShortName } from '../../components/emoji/lib';
import { getIntl } from '../selectors/user';
import { getConversationSelector } from '../selectors/conversations';
import {
  getBlessedStickerPacks,
  getInstalledStickerPacks,
  getKnownStickerPacks,
  getReceivedStickerPacks,
  getRecentlyInstalledStickerPack,
  getRecentStickers,
} from '../selectors/stickers';

type ExternalProps = {
  id: string;
};

const selectRecentEmojis = createSelector(
  ({ emojis }: StateType) => emojis.recents,
  recents => recents.filter(isShortName)
);

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const conversation = getConversationSelector(state)(id);
  if (!conversation) {
    throw new Error(`Conversation id ${id} not found!`);
  }

  const { draftText } = conversation;

  const receivedPacks = getReceivedStickerPacks(state);
  const installedPacks = getInstalledStickerPacks(state);
  const blessedPacks = getBlessedStickerPacks(state);
  const knownPacks = getKnownStickerPacks(state);

  const installedPack = getRecentlyInstalledStickerPack(state);

  const recentStickers = getRecentStickers(state);
  const showIntroduction = get(
    state.items,
    ['showStickersIntroduction'],
    false
  );
  const showPickerHint =
    get(state.items, ['showStickerPickerHint'], false) &&
    receivedPacks.length > 0;

  const recentEmojis = selectRecentEmojis(state);

  return {
    // Base
    i18n: getIntl(state),
    startingText: draftText,
    // Emojis
    recentEmojis,
    skinTone: get(state, ['items', 'skinTone'], 0),
    // Stickers
    receivedPacks,
    installedPack,
    blessedPacks,
    knownPacks,
    installedPacks,
    recentStickers,
    showIntroduction,
    showPickerHint,
  };
};

const dispatchPropsMap = {
  ...mapDispatchToProps,
  onSetSkinTone: (tone: number) => mapDispatchToProps.putItem('skinTone', tone),
  clearShowIntroduction: () =>
    mapDispatchToProps.removeItem('showStickersIntroduction'),
  clearShowPickerHint: () =>
    mapDispatchToProps.removeItem('showStickerPickerHint'),
  onPickEmoji: mapDispatchToProps.useEmoji,
};

const smart = connect(mapStateToProps, dispatchPropsMap);

export const SmartCompositionArea = smart(CompositionArea);
