import React from 'react';

import {
  AddressType,
  ContactFormType,
  ContactType,
  Email,
  Phone,
  PostalAddress,
} from '../../types/Contact';
import { missingCaseError } from '../../util/missingCaseError';

import {
  renderAvatar,
  renderContactShorthand,
  renderName,
} from './_contactUtil';

import { LocalizerType } from '../../types/Util';

interface Props {
  contact: ContactType;
  hasSignalAccount: boolean;
  i18n: LocalizerType;
  onSendMessage: () => void;
}

function getLabelForEmail(method: Email, i18n: LocalizerType): string {
  switch (method.type) {
    case ContactFormType.CUSTOM:
      return method.label || i18n('email');
    case ContactFormType.HOME:
      return i18n('home');
    case ContactFormType.MOBILE:
      return i18n('mobile');
    case ContactFormType.WORK:
      return i18n('work');
    default:
      throw missingCaseError(method.type);
  }
}

function getLabelForPhone(method: Phone, i18n: LocalizerType): string {
  switch (method.type) {
    case ContactFormType.CUSTOM:
      return method.label || i18n('phone');
    case ContactFormType.HOME:
      return i18n('home');
    case ContactFormType.MOBILE:
      return i18n('mobile');
    case ContactFormType.WORK:
      return i18n('work');
    default:
      throw missingCaseError(method.type);
  }
}

function getLabelForAddress(
  address: PostalAddress,
  i18n: LocalizerType
): string {
  switch (address.type) {
    case AddressType.CUSTOM:
      return address.label || i18n('address');
    case AddressType.HOME:
      return i18n('home');
    case AddressType.WORK:
      return i18n('work');
    default:
      throw missingCaseError(address.type);
  }
}

export class ContactDetail extends React.Component<Props> {
  public renderSendMessage({
    hasSignalAccount,
    i18n,
    onSendMessage,
  }: {
    hasSignalAccount: boolean;
    i18n: (key: string, values?: Array<string>) => string;
    onSendMessage: () => void;
  }) {
    if (!hasSignalAccount) {
      return null;
    }

    // We don't want the overall click handler for this element to fire, so we stop
    //   propagation before handing control to the caller's callback.
    const onClick = (e: React.MouseEvent<{}>): void => {
      e.stopPropagation();
      onSendMessage();
    };

    return (
      <button className="module-contact-detail__send-message" onClick={onClick}>
        <div className="module-contact-detail__send-message__inner">
          <div className="module-contact-detail__send-message__bubble-icon" />
          {i18n('sendMessageToContact')}
        </div>
      </button>
    );
  }

  public renderEmail(items: Array<Email> | undefined, i18n: LocalizerType) {
    if (!items || items.length === 0) {
      return;
    }

    return items.map((item: Email) => {
      return (
        <div
          key={item.value}
          className="module-contact-detail__additional-contact"
        >
          <div className="module-contact-detail__additional-contact__type">
            {getLabelForEmail(item, i18n)}
          </div>
          {item.value}
        </div>
      );
    });
  }

  public renderPhone(items: Array<Phone> | undefined, i18n: LocalizerType) {
    if (!items || items.length === 0) {
      return;
    }

    return items.map((item: Phone) => {
      return (
        <div
          key={item.value}
          className="module-contact-detail__additional-contact"
        >
          <div className="module-contact-detail__additional-contact__type">
            {getLabelForPhone(item, i18n)}
          </div>
          {item.value}
        </div>
      );
    });
  }

  public renderAddressLine(value: string | undefined) {
    if (!value) {
      return;
    }

    return <div>{value}</div>;
  }

  public renderPOBox(poBox: string | undefined, i18n: LocalizerType) {
    if (!poBox) {
      return null;
    }

    return (
      <div>
        {i18n('poBox')} {poBox}
      </div>
    );
  }

  public renderAddressLineTwo(address: PostalAddress) {
    if (address.city || address.region || address.postcode) {
      return (
        <div>
          {address.city} {address.region} {address.postcode}
        </div>
      );
    }

    return null;
  }

  public renderAddresses(
    addresses: Array<PostalAddress> | undefined,
    i18n: LocalizerType
  ) {
    if (!addresses || addresses.length === 0) {
      return;
    }

    return addresses.map((address: PostalAddress, index: number) => {
      return (
        <div key={index} className="module-contact-detail__additional-contact">
          <div className="module-contact-detail__additional-contact__type">
            {getLabelForAddress(address, i18n)}
          </div>
          {this.renderAddressLine(address.street)}
          {this.renderPOBox(address.pobox, i18n)}
          {this.renderAddressLine(address.neighborhood)}
          {this.renderAddressLineTwo(address)}
          {this.renderAddressLine(address.country)}
        </div>
      );
    });
  }

  public render() {
    const { contact, hasSignalAccount, i18n, onSendMessage } = this.props;
    const isIncoming = false;
    const module = 'contact-detail';

    return (
      <div className="module-contact-detail">
        <div className="module-contact-detail__avatar">
          {renderAvatar({ contact, i18n, size: 80 })}
        </div>
        {renderName({ contact, isIncoming, module })}
        {renderContactShorthand({ contact, isIncoming, module })}
        {this.renderSendMessage({ hasSignalAccount, i18n, onSendMessage })}
        {this.renderPhone(contact.number, i18n)}
        {this.renderEmail(contact.email, i18n)}
        {this.renderAddresses(contact.address, i18n)}
      </div>
    );
  }
}
