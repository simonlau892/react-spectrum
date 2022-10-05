import {mergeProps, mergeRefs, useLayoutEffect, useObjectRef} from '@react-aria/utils';
import React, {CSSProperties, ReactNode, RefCallback, RefObject, useCallback, useContext, useEffect, useRef, useState} from 'react';

export const slotCallbackSymbol = Symbol('callback');

interface SlottedValue<T> {
  slots?: Record<string, T>,
  [slotCallbackSymbol]?: (value: T) => void
}

type ProviderValue<T> = [React.Context<T>, SlottedValue<T> | T];
type ProviderValues<A, B, C, D, E, F, G> =
  | [ProviderValue<A>]
  | [ProviderValue<A>, ProviderValue<B>]
  | [ProviderValue<A>, ProviderValue<B>, ProviderValue<C>]
  | [ProviderValue<A>, ProviderValue<B>, ProviderValue<C>, ProviderValue<D>]
  | [ProviderValue<A>, ProviderValue<B>, ProviderValue<C>, ProviderValue<D>, ProviderValue<E>]
  | [ProviderValue<A>, ProviderValue<B>, ProviderValue<C>, ProviderValue<D>, ProviderValue<E>, ProviderValue<F>]
  | [ProviderValue<A>, ProviderValue<B>, ProviderValue<C>, ProviderValue<D>, ProviderValue<E>, ProviderValue<F>, ProviderValue<G>];

interface ProviderProps<A, B, C, D, E, F, G> {
  values: ProviderValues<A, B, C, D, E, F, G>,
  children: React.ReactNode
}

export function Provider<A, B, C, D, E, F, G>({values, children}: ProviderProps<A, B, C, D, E, F, G>): JSX.Element {
  for (let [Context, value] of values) {
    // @ts-ignore
    children = <Context.Provider value={value}>{children}</Context.Provider>;
  }

  return children as JSX.Element;
}

export interface StyleProps {
  className?: string,
  style?: CSSProperties
}

export interface DOMProps extends StyleProps {
  children?: ReactNode
}

export interface StyleRenderProps<T> {
  className?: string | ((values: T) => string),
  style?: CSSProperties | ((values: T) => CSSProperties)
}

export interface RenderProps<T> extends StyleRenderProps<T> {
  children?: ReactNode | ((values: T) => ReactNode)
}

interface RenderPropsHookOptions<T> extends RenderProps<T> {
  values: T,
  defaultChildren?: ReactNode,
  defaultClassName?: string
}

export function useRenderProps<T>({className, style, children, defaultClassName, defaultChildren, values}: RenderPropsHookOptions<T>) {
  if (typeof className === 'function') {
    className = className(values);
  }

  if (typeof style === 'function') {
    style = style(values);
  }

  if (typeof children === 'function') {
    children = children(values);
  } else if (children == null) {
    children = defaultChildren;
  }

  return {
    className: className ?? defaultClassName,
    style,
    children
  };
}

export type WithRef<T, E> = T & {ref?: React.ForwardedRef<E>};
export interface SlotProps {
  slot?: string
}

export function useContextProps<T, U, E extends Element>(props: T & SlotProps, ref: React.ForwardedRef<E>, context: React.Context<WithRef<SlottedValue<U> | U, E>>): [T, React.RefObject<E>] {
  let ctx = useContext(context) || {};
  if ('slots' in ctx) {
    if (!props.slot) {
      throw new Error('A slot prop is required');
    }
    if (!ctx.slots[props.slot]) {
      // @ts-ignore
      throw new Error(`Invalid slot "${props.slot}". Valid slot names are ` + new Intl.ListFormat().format(Object.keys(contextProps.slots).map(p => `"${p}"`)) + '.');
    }
    ctx = ctx.slots[props.slot];
  }
  // @ts-ignore - TS says "Type 'unique symbol' cannot be used as an index type." but not sure why.
  let {ref: contextRef, [slotCallbackSymbol]: callback, ...contextProps} = ctx;
  let mergedRef = useObjectRef(mergeRefs(ref, contextRef));
  let mergedProps = mergeProps(contextProps, props) as unknown as T;

  // A parent component might need the props from a child, so call slot callback if needed.
  useEffect(() => {
    if (callback) {
      callback(props);
    }
  }, [callback, props]);

  return [mergedProps, mergedRef];
}

export function useSlot(): [RefCallback<Element>, boolean] {
  // Assume we do have the slot in the initial render.
  let [hasSlot, setHasSlot] = useState(true);
  let hasRun = useRef(false);

  // A callback ref which will run when the slotted element mounts.
  // This should happen before the useLayoutEffect below.
  let ref = useCallback(el => {
    hasRun.current = true;
    setHasSlot(!!el);
  }, []);

  // If the callback hasn't been called, then reset to false.
  useLayoutEffect(() => {
    if (!hasRun.current) {
      setHasSlot(false);
    }
  }, []);

  return [ref, hasSlot];
}

export function useEnterAnimation(ref: RefObject<HTMLElement>, isReady: boolean = true) {
  let [isEntering, setEntering] = useState(true);
  useAnimation(ref, isEntering && isReady, useCallback(() => setEntering(false), []));
  return isEntering && isReady;
}

export function useExitAnimation(ref: RefObject<HTMLElement>, isOpen: boolean) {
  // State to trigger a re-render after animation is complete, which causes the element to be removed from the DOM.
  // Ref to track the state we're in, so we don't immediately reset isExiting to true after the animation.
  let [isExiting, setExiting] = useState(false);
  let exitState = useRef('idle');

  // If isOpen becomes false, set isExiting to true.
  if (!isOpen && ref.current && exitState.current === 'idle') {
    isExiting = true;
    setExiting(true);
    exitState.current = 'exiting';
  }

  // If we exited, and the element has been removed, reset exit state to idle.
  if (!ref.current && exitState.current === 'exited') {
    exitState.current = 'idle';
  }

  useAnimation(
    ref,
    isExiting,
    useCallback(() => {
      exitState.current = 'exited';
      setExiting(false);
    }, [])
  );

  return isExiting;
}

function useAnimation(ref: RefObject<HTMLElement>, isActive: boolean, onEnd: () => void) {
  let prevAnimation = useRef(null);
  if (isActive && ref.current) {
    prevAnimation.current = window.getComputedStyle(ref.current).animation;
  }

  useLayoutEffect(() => {
    if (isActive && ref.current) {
      // Make sure there's actually an animation, and it wasn't there before we triggered the update.
      let computedStyle = window.getComputedStyle(ref.current);
      if (computedStyle.animationName !== 'none' && computedStyle.animation !== prevAnimation.current) {
        let onAnimationEnd = (e: AnimationEvent) => {
          if (e.target === ref.current) {
            onEnd();
          }
        };

        let element = ref.current;
        element.addEventListener('animationend', onAnimationEnd, {once: true});
        return () => {
          element.removeEventListener('animationend', onAnimationEnd);
        };
      } else {
        onEnd();
      }
    }
  }, [ref, isActive, onEnd]);
}
