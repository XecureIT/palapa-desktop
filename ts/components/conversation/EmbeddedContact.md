### With a contact

#### Including all data types

```jsx
const contact = {
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0000',
      type: 1,
    },
  ],
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
  onClick: () => console.log('onClick'),
  onSendMessage: () => console.log('onSendMessage'),
  signalAccount: '+12025550000',
};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```

#### Image download pending

```jsx
const contact = {
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0000',
      type: 1,
    },
  ],
  avatar: {
    avatar: {
      pending: true,
    },
  },
  onClick: () => console.log('onClick'),
  onSendMessage: () => console.log('onSendMessage'),
  signalAccount: '+12025550000',
};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```

#### Really long data

```jsx
const contact = {
  name: {
    displayName:
      'Dr. First Middle Last Junior Senior and all that and a bag of chips',
  },
  number: [
    {
      value: '(202) 555-0000 0000 0000 0000 0000 0000 0000 0000 0000 0000',
      type: 1,
    },
  ],
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```

#### In group conversation

```jsx
const contact = {
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0000',
      type: 1,
    },
  ],
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
  signalAccount: '+12025550000',
};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      authorColor="green"
      conversationType="group"
      authorName="Mr. Fire"
      authorAvatarPath={util.gifObjectUrl}
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      authorName="Mr. Fire"
      conversationType="group"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      conversationType="group"
      authorName="Mr. Fire"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```

#### If contact has no signal account

```jsx
const contact = {
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0000',
      type: 1,
    },
  ],
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```

#### With organization name instead of name

```jsx
const contact = {
  organization: 'United Somewheres, Inc.',
  email: [
    {
      value: 'someone@somewheres.com',
      type: 2,
    },
  ],
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```

#### No displayName or organization

```jsx
const contact = {
  name: {
    givenName: 'Someone',
  },
  number: [
    {
      value: '(202) 555-1000',
      type: 1,
    },
  ],
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
  signalAccount: '+12025551000',
};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```

#### Default avatar

```jsx
const contact = {
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-1001',
      type: 1,
    },
  ],
};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```

#### Empty contact

```jsx
const contact = {};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contact}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```

#### Contact with caption (cannot currently be sent)

```jsx
const contactWithAccount = {
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0000',
      type: 1,
    },
  ],
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
  signalAccount: '+12025550000',
};
const contactWithoutAccount = {
  name: {
    displayName: 'Someone Somewhere',
  },
  number: [
    {
      value: '(202) 555-0000',
      type: 1,
    },
  ],
  avatar: {
    avatar: {
      path: util.gifObjectUrl,
    },
  },
};
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      text="I want to introduce you to Someone..."
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithAccount}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      text="I want to introduce you to Someone..."
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithAccount}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      text="I want to introduce you to Someone..."
      authorColor="green"
      direction="incoming"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithAccount}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      text="I want to introduce you to Someone..."
      authorColor="green"
      direction="outgoing"
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithAccount}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      text="I want to introduce you to Someone..."
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithoutAccount}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      text="I want to introduce you to Someone..."
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithoutAccount}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      text="I want to introduce you to Someone..."
      authorColor="green"
      direction="incoming"
      collapseMetadata
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithoutAccount}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
  <div className="module-message-container">
    <Message
      text="I want to introduce you to Someone..."
      authorColor="green"
      direction="outgoing"
      collapseMetadata
      status="delivered"
      i18n={util.i18n}
      timestamp={Date.now()}
      contact={contactWithoutAccount}
      selectMessage={(...args) => console.log('selectMessage', args)}
    />
  </div>
</util.ConversationContext>;
```
