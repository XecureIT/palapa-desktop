Note that this component is controlled, so the text in the search box will only update
if the parent of this component feeds the updated `searchTerm` back.

#### With image

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    searchTerm=""
    avatarPath={util.gifObjectUrl}
    search={text => console.log('search', text)}
    updateSearchTerm={text => console.log('updateSearchTerm', text)}
    clearSearch={() => console.log('clearSearch')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Just name

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    searchTerm=""
    name="John Smith"
    color="purple"
    search={text => console.log('search', text)}
    updateSearchTerm={text => console.log('updateSearchTerm', text)}
    clearSearch={() => console.log('clearSearch')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Just phone number

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    searchTerm=""
    phoneNumber="+15553004000"
    color="green"
    search={text => console.log('search', text)}
    updateSearchTerm={text => console.log('updateSearchTerm', text)}
    clearSearch={() => console.log('clearSearch')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Starting with a search term

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    name="John Smith"
    color="purple"
    searchTerm="Hewwo?"
    search={text => console.log('search', text)}
    updateSearchTerm={text => console.log('updateSearchTerm', text)}
    clearSearch={() => console.log('clearSearch')}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Searching within conversation

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    name="John Smith"
    color="purple"
    searchConversationId="group-id-1"
    searchConversationName="Everyone 🔥"
    search={(...args) => console.log('search', args)}
    updateSearchTerm={(...args) => console.log('updateSearchTerm', args)}
    clearSearch={(...args) => console.log('clearSearch', args)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```

#### Searching within conversation, with search term

```jsx
<util.LeftPaneContext theme={util.theme}>
  <MainHeader
    name="John Smith"
    color="purple"
    searchConversationId="group-id-1"
    searchConversationName="Everyone 🔥"
    searchTerm="address"
    search={(...args) => console.log('search', args)}
    updateSearchTerm={(...args) => console.log('updateSearchTerm', args)}
    clearSearch={(...args) => console.log('clearSearch', args)}
    i18n={util.i18n}
  />
</util.LeftPaneContext>
```
