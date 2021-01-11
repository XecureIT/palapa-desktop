### With a quotation, text-only replies

#### Plain text

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
</util.ConversationContext>
```

#### Name variations

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Profile name"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        authorProfileName: 'OnFire',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Profile name"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        authorProfileName: 'OnFire',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Profile name"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        authorProfileName: 'OnFire',
        authorName: 'Mr. Fire',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Profile name"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        authorProfileName: 'OnFire',
        authorName: 'Mr. Fire',
      }}
    />
  </div>
</util.ConversationContext>
```

#### With emoji

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="About 🔥six🔥"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many 🔥ferrets🔥 do you have?',
        authorName: 'Mr. 🔥Fire🔥',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="About 🔥six🔥"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many 🔥ferrets🔥 do you have?',
        authorName: 'Mr. 🔥Fire🔥',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Replies to you or yourself

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        isFromMe: true,
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        isFromMe: true,
      }}
    />
  </div>
</util.ConversationContext>
```

#### In a group conversation

```jsx
<util.ConversationContext
  theme={util.theme}
  type="group"
  ios={util.ios}
  mode={util.mode}
>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      conversationType="group"
      authorName="Mr. 🔥Fire🔥"
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
      authorAvatarPath={util.gifObjectUrl}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      conversationType="group"
      authorName="Mr. 🔥Fire🔥"
      status="sending"
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
      authorAvatarPath={util.gifObjectUrl}
    />
  </div>
</util.ConversationContext>
```

#### All colors

Note: for incoming messages, quote color is taken from the parent message. For outgoing
messages the color is taken from the contact who wrote the quoted message.

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="red"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'red',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="red"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'red',
        text: 'red',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="red"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'deep_orange',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="deep_orange"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'deep_orange',
        text: 'deep_orange',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="brown"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'brown',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="brown"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'brown',
        text: 'brown',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="pink"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'pink',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="pink"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'pink',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="purple"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'purple',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="purple"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'purple',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="indigo"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'indigo',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="indigo"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'indigo',
        text: 'indigo',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="blue"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'blue',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="blue"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'blue',
        text: 'blue',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="teal"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'teal',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="teal"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'teal',
        text: 'teal',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'green',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'green',
        text: 'green',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="light_green"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'light_green',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="light_green"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'light_green',
        text: 'light_green',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="blue_grey"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'blue_grey',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="blue_grey"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'blue_grey',
        text: 'blue_grey',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="grey"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'pink',
        text: 'grey',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="grey"
      text="Nice!"
      i18n={util.i18n}
      quote={{
        authorColor: 'grey',
        text: 'grey',
        authorPhoneNumber: '(202) 555-0011',
        onClick: () => console.log('onClick'),
      }}
    />
  </div>
</util.ConversationContext>
```

#### Referenced message not found

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        isFromMe: true,
        referencedMessageNotFound: true,
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        isFromMe: true,
        referencedMessageNotFound: true,
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      conversationType="group"
      authorName="Mr. 🔥Fire🔥"
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        referencedMessageNotFound: true,
      }}
      authorAvatarPath={util.gifObjectUrl}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      conversationType="group"
      authorName="Mr. 🔥Fire🔥"
      status="sending"
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
        referencedMessageNotFound: true,
      }}
      authorAvatarPath={util.gifObjectUrl}
    />
  </div>
</util.ConversationContext>
```

#### Long names and context

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Woo, otters!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text:
          'A really long link https://app.zeplin.io/project/5b2136b8e490ad6a54399857/screen/5b3bd068e03b763a0ee4c3e9',
        authorPhoneNumber: '(202) 555-0011',
        authorProfileName:
          'Really really really really really really really really really long!',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Woo, otters!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text:
          'A really long link https://app.zeplin.io/project/5b2136b8e490ad6a54399857/screen/5b3bd068e03b763a0ee4c3e9',
        authorPhoneNumber: '(202) 555-0011',
        authorProfileName:
          'Really really really really really really really really really long!',
      }}
    />
  </div>
</util.ConversationContext>
```

#### A lot of text in quotation

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Woo, otters!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text:
          'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
          'After that, probably dogs. And then, you know, reptiles of all types. ' +
          'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
          'really smart.',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Woo, otters!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text:
          'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
          'After that, probably dogs. And then, you know, reptiles of all types. ' +
          'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
          'really smart.',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### A lot of text in quotation, with icon

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Woo, otters!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text:
          'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
          'After that, probably dogs. And then, you know, reptiles of all types. ' +
          'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
          'really smart.',
        attachment: {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Woo, otters!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text:
          'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
          'After that, probably dogs. And then, you know, reptiles of all types. ' +
          'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
          'really smart.',
        attachment: {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### A lot of text in quotation, with image

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Woo, otters!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text:
          'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
          'After that, probably dogs. And then, you know, reptiles of all types. ' +
          'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
          'really smart.',
        attachment: {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Woo, otters!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text:
          'I have lots of things to say. First, I enjoy otters. Second best are cats. ' +
          'After that, probably dogs. And then, you know, reptiles of all types. ' +
          'Then birds. They are dinosaurs, after all. Then cephalapods, because they are ' +
          'really smart.',
        attachment: {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Image with caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Totally, it's a pretty unintuitive concept."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'I am pretty confused about Pi.',
        attachment: {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Totally, it's a pretty unintuitive concept."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'I am pretty confused about Pi.',
        attachment: {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Image

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Yeah, pi. Tough to wrap your head around."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Yeah, pi. Tough to wrap your head around."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'image/gif',
          fileName: 'pi.gif',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Image with no thumbnail

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Yeah, pi. Tough to wrap your head around."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'image/gif',
          fileName: 'pi.gif',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Yeah, pi. Tough to wrap your head around."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          pending: true,
          contentType: 'image/gif',
          fileName: 'pi.gif',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Pending image download

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Yeah, pi. Tough to wrap your head around."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'image/gif',
          fileName: 'pi.gif',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Yeah, pi. Tough to wrap your head around."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          pending: true,
          contentType: 'image/gif',
          fileName: 'pi.gif',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Video with caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Sweet the way the video sneaks up on you!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'Check out this video I found!',
        attachment: {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Sweet the way the video sneaks up on you!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'Check out this video I found!',
        attachment: {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Video

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Awesome!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Awesome!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
            objectUrl: util.gifObjectUrl,
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Video with no thumbnail

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Awesome!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Awesome!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'video/mp4',
          fileName: 'freezing_bubble.mp4',
          thumbnail: {
            contentType: 'image/gif',
          },
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Audio with caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="I really like it!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'Check out this beautiful song!',
        attachment: {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="I really like it!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'Check out this beautiful song!',
        attachment: {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Audio

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="I really like it!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="I really like it!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Voice message

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Thanks for letting me know!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
          // Note: generated from 'flags' attribute, proposed afternoon of
          //   4/6 in Quoted Replies group
          isVoiceMessage: true,
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Thanks for letting me know!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'audio/mp3',
          fileName: 'agnus_dei.mp4',
          isVoiceMessage: true,
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Other file type with caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="I can't read latin."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'This is my manifesto. Tell me what you think!',
        attachment: {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="I can't read latin."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'This is my manifesto. Tell me what you think!',
        attachment: {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="I can't read latin."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'This is my manifesto. Tell me what you think!',
        attachment: {
          contentType: 'text/plain',
          fileName:
            'really_really_really_really_really_really_really_really_really_long.txt',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="I can't read latin."
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'This is my manifesto. Tell me what you think!',
        attachment: {
          contentType: 'text/plain',
          fileName:
            'really_really_really_really_really_really_really_really_really_long.txt',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Other file type

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      text="Sorry, I can't read latin!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      authorColor="green"
      text="Sorry, I can't read latin!"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        attachment: {
          contentType: 'text/plain',
          fileName: 'lorum_ipsum.txt',
        },
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

### With a quotation, including attachment

#### Quote, image attachment, and caption

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      attachment={{
        url: util.gifObjectUrl,
        fileName: 'pi.gif',
        contentType: 'image/gif',
        width: 320,
        height: 240,
      }}
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      attachment={{
        url: util.gifObjectUrl,
        fileName: 'pi.gif',
        contentType: 'image/gif',
        width: 320,
        height: 240,
      }}
      authorColor="green"
      text="About six"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Quote, image attachment

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      attachment={{
        url: util.gifObjectUrl,
        fileName: 'pi.gif',
        contentType: 'image/gif',
        width: 320,
        height: 240,
      }}
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      attachment={{
        url: util.gifObjectUrl,
        fileName: 'pi.gif',
        contentType: 'image/gif',
        width: 320,
        height: 240,
      }}
      authorColor="green"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Quote, portrait image attachment

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      attachment={{
        url: util.portraitYellowObjectUrl,
        fileName: 'pi.gif',
        contentType: 'image/gif',
        width: 20,
        height: 200,
      }}
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      attachment={{
        url: util.portraitYellowObjectUrl,
        fileName: 'pi.gif',
        contentType: 'image/gif',
        width: 20,
        height: 200,
      }}
      authorColor="green"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Quote, video attachment

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      attachment={{
        screenshot: {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
        fileName: 'freezing_bubble.mp4',
        contentType: 'video/mp4',
        width: 800,
        height: 1200,
      }}
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      attachment={{
        screenshot: {
          url: util.pngObjectUrl,
          contentType: 'image/png',
          width: 800,
          height: 1200,
        },
        fileName: 'freezing_bubble.mp4',
        contentType: 'video/mp4',
        width: 800,
        height: 1200,
      }}
      authorColor="green"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Quote, audio attachment

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      attachment={{
        data: util.mp3ObjectUrl,
        fileName: 'agnus_dei.mp3',
        contentType: 'audio/mp3',
      }}
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      attachment={{
        data: util.mp3ObjectUrl,
        fileName: 'agnus_dei.mp3',
        contentType: 'audio/mp3',
      }}
      authorColor="green"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

#### Quote, file attachment

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="module-message-container">
    <Message
      direction="incoming"
      timestamp={Date.now()}
      authorColor="green"
      attachment={{
        data: util.txtObjectUrl,
        fileName: 'lorum_ipsum.txt',
        contentType: 'text/plain',
        fileSize: '3.05 KB',
      }}
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
  <div className="module-message-container">
    <Message
      direction="outgoing"
      timestamp={Date.now()}
      status="sending"
      attachment={{
        data: util.txtObjectUrl,
        fileName: 'lorum_ipsum.txt',
        contentType: 'text/plain',
        fileSize: '3.05 KB',
      }}
      authorColor="green"
      i18n={util.i18n}
      quote={{
        authorColor: 'purple',
        text: 'How many ferrets do you have?',
        authorPhoneNumber: '(202) 555-0011',
      }}
    />
  </div>
</util.ConversationContext>
```

### In bottom bar

#### Plain text

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorPhoneNumber="(202) 555-1000"
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      i18n={util.i18n}
      onClick={() => console.log('onClick')}
    />
  </div>
</util.ConversationContext>
```

#### With an icon

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorPhoneNumber="(202) 555-1000"
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      i18n={util.i18n}
      attachment={{
        contentType: 'image/jpeg',
        fileName: 'llama.jpg',
      }}
      onClick={() => console.log('onClick')}
    />
  </div>
</util.ConversationContext>
```

#### With an image

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorPhoneNumber="(202) 555-1000"
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      i18n={util.i18n}
      attachment={{
        contentType: 'image/gif',
        fileName: 'llama.gif',
        thumbnail: {
          objectUrl: util.gifObjectUrl,
        },
      }}
      onClick={() => console.log('onClick')}
    />
  </div>
</util.ConversationContext>
```

#### With attachment and no text

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="bottom-bar">
    <Quote
      authorColor="blue"
      authorPhoneNumber="(202) 555-1000"
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      i18n={util.i18n}
      attachment={{
        contentType: 'image/gif',
        fileName: 'llama.gif',
        thumbnail: {
          objectUrl: util.gifObjectUrl,
        },
      }}
      onClick={() => console.log('onClick')}
    />
  </div>
</util.ConversationContext>
```

#### With generic attachment

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorPhoneNumber="(202) 555-1000"
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      i18n={util.i18n}
      attachment={{
        contentType: 'text/plain',
        fileName: 'manifesto.text',
      }}
      onClick={() => console.log('onClick')}
    />
  </div>
</util.ConversationContext>
```

#### With a close button

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorPhoneNumber="(202) 555-1000"
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      onClose={() => console.log('onClose')}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
    />
  </div>
</util.ConversationContext>
```

#### With a close button and icon

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorPhoneNumber="(202) 555-1000"
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      onClose={() => console.log('onClose')}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
      attachment={{
        contentType: 'image/jpeg',
        fileName: 'llama.jpg',
      }}
    />
  </div>
</util.ConversationContext>
```

#### With a close button and image

```jsx
<util.ConversationContext theme={util.theme} ios={util.ios} mode={util.mode}>
  <div className="bottom-bar">
    <Quote
      text="How many ferrets do you have?"
      authorColor="blue"
      authorPhoneNumber="(202) 555-1000"
      authorProfileName="Mr. Blue"
      id={Date.now() - 1000}
      onClose={() => console.log('onClose')}
      onClick={() => console.log('onClick')}
      i18n={util.i18n}
      attachment={{
        contentType: 'image/gif',
        fileName: 'llama.gif',
        thumbnail: {
          objectUrl: util.gifObjectUrl,
        },
      }}
    />
  </div>
</util.ConversationContext>
```
