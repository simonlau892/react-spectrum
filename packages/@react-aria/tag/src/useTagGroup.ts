/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {AriaLabelingProps, DOMAttributes, DOMProps} from '@react-types/shared';
import {filterDOMProps, mergeProps, useId} from '@react-aria/utils';
// @ts-ignore
import intlMessages from '../intl/*.json';
import {RefObject, useState} from 'react';
import {TagGroupProps} from '@react-types/tag';
import type {TagGroupState} from '@react-stately/tag';
import {TagKeyboardDelegate} from './TagKeyboardDelegate';
import {useFocusWithin} from '@react-aria/interactions';
import {useGridList} from '@react-aria/gridlist';
import {useLocale} from '@react-aria/i18n';
import {useLocalizedStringFormatter} from '@react-aria/i18n';

export interface TagGroupAria {
  /** Props for the tag grouping element. */
  tagGroupProps: DOMAttributes,
  /** Props for an optional group of actions. */
  tagGroupActionsProps: DOMAttributes
}

export interface AriaTagGroupProps<T> extends TagGroupProps<T>, DOMProps, AriaLabelingProps {
  /**
   * An optional keyboard delegate to handle arrow key navigation,
   * to override the default.
   */
  keyboardDelegate?: TagKeyboardDelegate<T>
}

/**
 * Provides the behavior and accessibility implementation for a tag group component.
 * Tags allow users to categorize content. They can represent keywords or people, and are grouped to describe an item or a search request.
 * @param props - Props to be applied to the tag group.
 * @param state - State for the tag group, as returned by `useTagGroupState`.
 * @param ref - A ref to a DOM element for the tag group.
 */
export function useTagGroup<T>(props: AriaTagGroupProps<T>, state: TagGroupState<T>, ref: RefObject<HTMLElement>): TagGroupAria {
  let {direction} = useLocale();
  let stringFormatter = useLocalizedStringFormatter(intlMessages);
  let keyboardDelegate = props.keyboardDelegate || new TagKeyboardDelegate(state.collection, direction);
  let actionsId = useId();
  let {gridProps} = useGridList({...props, keyboardDelegate}, state, ref);

  // Don't want the grid to be focusable or accessible via keyboard
  delete gridProps.role;
  delete gridProps.tabIndex;

  let [isFocusWithin, setFocusWithin] = useState(false);
  let {focusWithinProps} = useFocusWithin({
    onFocusWithinChange: setFocusWithin
  });
  let domProps = filterDOMProps(props);
  return {
    tagGroupProps: mergeProps(gridProps, domProps, {
      'aria-atomic': false,
      'aria-relevant': 'additions',
      'aria-live': isFocusWithin ? 'polite' : 'off',
      ...focusWithinProps
    }),
    tagGroupActionsProps: gridProps['aria-label'] ? {
      role: 'group',
      id: actionsId,
      'aria-label': stringFormatter.format('actions'),
      'aria-labelledby': `${gridProps.id} ${actionsId}`
    } : {}
  };
}
