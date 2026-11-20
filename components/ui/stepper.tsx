"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { cn } from "cn"

/*
 * A multi-step flow: numbered steps at the top, one panel per step.
 * Controlled: the parent decides the current step and which steps are
 * complete or reachable.
 *
 *   <Stepper value={step} onValueChange={setStep}>
 *     <StepperList>
 *       <StepperItem value={1} completed={uploaded}>
 *         <StepperTrigger>
 *           <StepperIndicator />
 *           <StepperText>
 *             <StepperTitle>Import file</StepperTitle>
 *             <StepperDescription>Upload an .xlsx</StepperDescription>
 *           </StepperText>
 *         </StepperTrigger>
 *       </StepperItem>
 *       <StepperItem value={2} disabled={!uploaded}>…</StepperItem>
 *     </StepperList>
 *     <StepperContent value={1}>…</StepperContent>
 *     <StepperContent value={2}>…</StepperContent>
 *   </Stepper>
 */

type StepValue = string | number

interface StepperContextValue {
  value: StepValue
  onValueChange?: (value: StepValue) => void
  orientation: "horizontal" | "vertical"
}

const StepperContext = React.createContext<StepperContextValue | null>(null)

function useStepper() {
  const context = React.useContext(StepperContext)
  if (!context) {
    throw new Error("Stepper components must be used inside <Stepper>.")
  }
  return context
}

interface StepperItemContextValue {
  value: StepValue
  /** 1-based position, shown by StepperIndicator. */
  number: number
  state: "active" | "completed" | "upcoming"
  disabled: boolean
}

const StepperItemContext = React.createContext<StepperItemContextValue | null>(
  null
)

function useStepperItem() {
  const context = React.useContext(StepperItemContext)
  if (!context) {
    throw new Error("This component must be used inside <StepperItem>.")
  }
  return context
}

function Stepper<Value extends StepValue>({
  value,
  onValueChange,
  orientation = "horizontal",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  /** The current step. */
  value: Value
  /** Called when a step's trigger is clicked. */
  onValueChange?: (value: Value) => void
  orientation?: "horizontal" | "vertical"
}) {
  const context = React.useMemo<StepperContextValue>(
    () => ({
      value,
      onValueChange: onValueChange as StepperContextValue["onValueChange"],
      orientation,
    }),
    [value, onValueChange, orientation]
  )
  return (
    <StepperContext.Provider value={context}>
      <div
        data-slot="stepper"
        data-orientation={orientation}
        className={cn("flex flex-col gap-6", className)}
        {...props}
      />
    </StepperContext.Provider>
  )
}

function StepperList({
  className,
  children,
  ...props
}: React.ComponentProps<"ol">) {
  const { orientation } = useStepper()
  // Number the items in order, for StepperIndicator.
  let number = 0
  const numbered = React.Children.map(children, (child) =>
    React.isValidElement(child) && child.type === StepperItem
      ? React.cloneElement(child as React.ReactElement<StepperItemProps>, {
          number: ++number,
        })
      : child
  )
  return (
    <ol
      data-slot="stepper-list"
      data-orientation={orientation}
      className={cn(
        "grid gap-2",
        orientation === "horizontal"
          ? "auto-cols-fr sm:grid-flow-col"
          : "grid-cols-1",
        className
      )}
      {...props}
    >
      {numbered}
    </ol>
  )
}

type StepperItemProps = React.ComponentProps<"li"> & {
  value: StepValue
  /** Shows a check instead of the number (unless it's the current step). */
  completed?: boolean
  /** Can't be selected yet. */
  disabled?: boolean
  /** Set by StepperList. */
  number?: number
}

function StepperItem({
  value,
  completed = false,
  disabled = false,
  number = 0,
  className,
  ...props
}: StepperItemProps) {
  const stepper = useStepper()
  const state =
    stepper.value === value ? "active" : completed ? "completed" : "upcoming"
  const context = React.useMemo(
    () => ({ value, number, state, disabled }) as const,
    [value, number, state, disabled]
  )
  return (
    <StepperItemContext.Provider value={context}>
      <li
        data-slot="stepper-item"
        data-state={state}
        data-disabled={disabled || undefined}
        aria-current={state === "active" ? "step" : undefined}
        className={cn("group/stepper-item min-w-0", className)}
        {...props}
      />
    </StepperItemContext.Provider>
  )
}

/** The clickable part of a step: selects it (unless disabled). */
function StepperTrigger({
  className,
  onClick,
  disabled,
  ...props
}: React.ComponentProps<"button">) {
  const stepper = useStepper()
  const item = useStepperItem()
  return (
    <button
      type="button"
      data-slot="stepper-trigger"
      disabled={disabled ?? item.disabled}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) stepper.onValueChange?.(item.value)
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent group-data-[state=active]/stepper-item:border-primary group-data-[state=active]/stepper-item:bg-muted/50",
        className
      )}
      {...props}
    />
  )
}

/** The step's number, or a check once it's completed. */
function StepperIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  const item = useStepperItem()
  return (
    <span
      data-slot="stepper-indicator"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums group-data-[state=active]/stepper-item:border-primary group-data-[state=active]/stepper-item:bg-primary group-data-[state=active]/stepper-item:text-primary-foreground group-data-[state=completed]/stepper-item:border-primary group-data-[state=completed]/stepper-item:bg-primary group-data-[state=completed]/stepper-item:text-primary-foreground",
        className
      )}
      {...props}
    >
      {children ??
        (item.state === "completed" ? (
          <CheckIcon className="size-3.5" />
        ) : (
          item.number
        ))}
    </span>
  )
}

function StepperText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stepper-text"
      className={cn("flex min-w-0 flex-col", className)}
      {...props}
    />
  )
}

function StepperTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stepper-title"
      className={cn("font-medium", className)}
      {...props}
    />
  )
}

function StepperDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stepper-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

/**
 * A step's panel, shown when it's the current step. With `keepMounted`
 * it stays mounted (hidden) on other steps, keeping its state (e.g. an
 * uploader's file list) when the user goes back.
 */
function StepperContent({
  value,
  keepMounted = false,
  className,
  ...props
}: React.ComponentProps<"section"> & {
  value: StepValue
  keepMounted?: boolean
}) {
  const stepper = useStepper()
  const active = stepper.value === value
  if (!active && !keepMounted) return null
  return (
    <section
      data-slot="stepper-content"
      data-state={active ? "active" : "inactive"}
      hidden={!active}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    />
  )
}

/** Back / Next buttons under a step's content. */
function StepperActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stepper-actions"
      className={cn("flex flex-wrap gap-2", className)}
      {...props}
    />
  )
}

export {
  Stepper,
  StepperList,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperText,
  StepperTitle,
  StepperDescription,
  StepperContent,
  StepperActions,
}
