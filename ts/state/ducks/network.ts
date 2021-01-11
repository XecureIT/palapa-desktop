import { SocketStatus } from '../../types/SocketStatus';
import { trigger } from '../../shims/events';

// State

export type NetworkStateType = {
  isOnline: boolean;
  socketStatus: SocketStatus;
  withinConnectingGracePeriod: boolean;
};

// Actions

const CHECK_NETWORK_STATUS = 'network/CHECK_NETWORK_STATUS';
const CLOSE_CONNECTING_GRACE_PERIOD = 'network/CLOSE_CONNECTING_GRACE_PERIOD';
const RELINK_DEVICE = 'network/RELINK_DEVICE';

export type CheckNetworkStatusPayloadType = {
  isOnline: boolean;
  socketStatus: SocketStatus;
};

type CheckNetworkStatusAction = {
  type: 'network/CHECK_NETWORK_STATUS';
  payload: CheckNetworkStatusPayloadType;
};

type CloseConnectingGracePeriodActionType = {
  type: 'network/CLOSE_CONNECTING_GRACE_PERIOD';
};

type RelinkDeviceActionType = {
  type: 'network/RELINK_DEVICE';
};

export type NetworkActionType =
  | CheckNetworkStatusAction
  | CloseConnectingGracePeriodActionType
  | RelinkDeviceActionType;

// Action Creators

function checkNetworkStatus(
  payload: CheckNetworkStatusPayloadType
): CheckNetworkStatusAction {
  return {
    type: CHECK_NETWORK_STATUS,
    payload,
  };
}

function closeConnectingGracePeriod(): CloseConnectingGracePeriodActionType {
  return {
    type: CLOSE_CONNECTING_GRACE_PERIOD,
  };
}

function relinkDevice(): RelinkDeviceActionType {
  trigger('setupAsNewDevice');

  return {
    type: RELINK_DEVICE,
  };
}

export const actions = {
  checkNetworkStatus,
  closeConnectingGracePeriod,
  relinkDevice,
};

// Reducer

function getEmptyState(): NetworkStateType {
  return {
    isOnline: navigator.onLine,
    socketStatus: WebSocket.OPEN,
    withinConnectingGracePeriod: true,
  };
}

export function reducer(
  state: NetworkStateType = getEmptyState(),
  action: NetworkActionType
): NetworkStateType {
  if (action.type === CHECK_NETWORK_STATUS) {
    const { isOnline, socketStatus } = action.payload;

    return {
      ...state,
      isOnline,
      socketStatus,
    };
  }

  if (action.type === CLOSE_CONNECTING_GRACE_PERIOD) {
    return {
      ...state,
      withinConnectingGracePeriod: false,
    };
  }

  return state;
}
