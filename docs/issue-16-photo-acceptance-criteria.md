# Issue #16: Photo acceptance criteria

These criteria define photo uploads for [issue #16](https://github.com/werzl/ocr-shopping-list/issues/16).

- A list can contain at most one photo at a time.
- Enable **Photo** only when an API key is active and the list has no photo. This includes lists saved without a photo during creation.
- Start recognition immediately when the user uploads a photo.
- Append the recognised items after the existing items. Preserve the existing items and their checked states. Allow duplicate items.
- **Save** commits the photo and appended items to the same list.
- **Cancel** restores the previous list and leaves it without a photo.
- Show a saved photo regardless of when the user uploaded it.
- Disable **Photo** while the list contains a photo.
- **Clear** deletes all items and the photo. It keeps the list, its name, and its category option.
- Allow another photo upload after **Clear**.
