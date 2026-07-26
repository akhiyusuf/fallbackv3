/* @ds-bundle: {"format":4,"namespace":"VerdantDesignSystem_a81bbe","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"IconButton","sourcePath":"components/actions/IconButton.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Callout","sourcePath":"components/display/Callout.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"ProgressBar","sourcePath":"components/display/ProgressBar.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"38e431a26221","components/actions/IconButton.jsx":"7c218ff60a6a","components/display/Badge.jsx":"f7948039a74a","components/display/Callout.jsx":"b4704b1721da","components/display/Card.jsx":"a8a68a4b802c","components/display/ProgressBar.jsx":"3565f3122325","components/feedback/Dialog.jsx":"7d3ab67c9def","components/forms/Checkbox.jsx":"c781bbc5eb28","components/forms/Input.jsx":"4ef45fdbe386","components/forms/Radio.jsx":"a3668913d1a3","components/forms/Select.jsx":"f3dea273cadd","components/forms/Switch.jsx":"aea60bf58330","ui_kits/learn/AppShell.jsx":"40af8db2d1f2","ui_kits/learn/Dashboard.jsx":"5ba2b2992dd7","ui_kits/learn/Lesson.jsx":"9db16af797b7","ui_kits/learn/Practice.jsx":"b6d9f026ac26"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.VerdantDesignSystem_a81bbe = window.VerdantDesignSystem_a81bbe || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Verdant primary CTA button.
 * Duolingo geometry + tactile bottom shadow. Leaf green for primary.
 */
function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  type = "button",
  onClick,
  style,
  children,
  ...rest
}) {
  const sizes = {
    sm: {
      padding: "10px 18px",
      fontSize: "14px"
    },
    md: {
      padding: "14px 24px",
      fontSize: "16px"
    },
    lg: {
      padding: "16px 28px",
      fontSize: "18px"
    }
  };
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    lineHeight: 1,
    border: "none",
    borderRadius: "var(--radius-lg)",
    cursor: disabled ? "not-allowed" : "pointer",
    width: fullWidth ? "100%" : "auto",
    transition: "transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
    userSelect: "none",
    opacity: disabled ? 0.5 : 1,
    ...sizes[size]
  };
  const variants = {
    primary: {
      background: "var(--accent)",
      color: "#ffffff",
      boxShadow: disabled ? "none" : "0 4px 0 0 var(--accent-deep)"
    },
    secondary: {
      background: "transparent",
      color: "var(--text)",
      border: "2px solid var(--border-strong)",
      boxShadow: disabled ? "none" : "0 4px 0 0 var(--border-strong)"
    },
    ghost: {
      background: "transparent",
      color: "var(--text)",
      boxShadow: "none"
    },
    danger: {
      background: "var(--danger)",
      color: "#ffffff",
      boxShadow: disabled ? "none" : "0 4px 0 0 #d63030"
    }
  };
  const [pressed, setPressed] = React.useState(false);
  const isTactile = variant === "primary" || variant === "secondary" || variant === "danger";
  const pressedStyle = pressed && isTactile && !disabled ? {
    transform: "translateY(2px)",
    boxShadow: "0 0 0 0 transparent"
  } : null;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    style: {
      ...base,
      ...variants[variant],
      ...pressedStyle,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Icon-only button. Square, subtle hover fill. For toolbars and nav.
 */
function IconButton({
  size = "md",
  variant = "ghost",
  disabled = false,
  ariaLabel,
  onClick,
  style,
  children,
  ...rest
}) {
  const dims = {
    sm: 32,
    md: 40,
    lg: 48
  };
  const d = dims[size];
  const [hover, setHover] = React.useState(false);
  const variants = {
    ghost: {
      background: hover && !disabled ? "var(--surface)" : "transparent",
      color: "var(--text-muted)",
      border: "none"
    },
    outline: {
      background: hover && !disabled ? "var(--surface)" : "var(--bg)",
      color: "var(--text)",
      border: "1px solid var(--border)"
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": ariaLabel,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: d,
      height: d,
      borderRadius: "var(--radius-sm)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "background var(--dur-fast) var(--ease-out)",
      ...variants[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge / pill. Neutral by default; `streak` / `xp` / `danger` / `accent` are
 * the confined signal variants with black tabular numerals.
 */
function Badge({
  variant = "neutral",
  style,
  children,
  ...rest
}) {
  const variants = {
    neutral: {
      background: "var(--surface)",
      color: "var(--text-muted)",
      fontWeight: 600
    },
    accent: {
      background: "var(--accent-soft)",
      color: "var(--accent-deep)",
      fontWeight: 700
    },
    streak: {
      background: "var(--streak)",
      color: "#fff",
      fontWeight: 800
    },
    xp: {
      background: "var(--xp)",
      color: "#fff",
      fontWeight: 800
    },
    danger: {
      background: "var(--danger)",
      color: "#fff",
      fontWeight: 700
    }
  };
  const isSignal = variant === "streak" || variant === "xp";
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      borderRadius: "var(--radius-pill)",
      fontFamily: "var(--font-sans)",
      fontSize: "14px",
      lineHeight: 1,
      fontVariantNumeric: isSignal ? "tabular-nums" : "normal",
      ...variants[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Callout.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Document callout — Notion pattern. Tinted block with a leading icon slot.
 */
function Callout({
  tone = "neutral",
  icon,
  title,
  style,
  children,
  ...rest
}) {
  const tones = {
    neutral: {
      background: "var(--bg-alt)",
      border: "var(--border)",
      accent: "var(--text-muted)"
    },
    accent: {
      background: "var(--accent-soft)",
      border: "#cdeeae",
      accent: "var(--accent-deep)"
    },
    streak: {
      background: "#fff3e0",
      border: "#ffd9a8",
      accent: "var(--streak)"
    },
    danger: {
      background: "#ffecec",
      border: "#ffc9c9",
      accent: "var(--danger)"
    }
  };
  const t = tones[tone];
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      gap: "12px",
      padding: "16px 18px",
      background: t.background,
      border: `1px solid ${t.border}`,
      borderRadius: "var(--radius-md)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: "0 0 auto",
      color: t.accent,
      fontSize: "18px",
      lineHeight: "26px",
      display: "flex"
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: "16px",
      color: "var(--text)",
      marginBottom: children ? "4px" : 0
    }
  }, title), children && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "16px",
      lineHeight: 1.6,
      color: "var(--text-muted)"
    }
  }, children)));
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Callout.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card / lesson tile. Notion pattern: flat, border-only. Never tactile.
 */
function Card({
  interactive = false,
  padding = "var(--space-4)",
  onClick,
  style,
  children,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: interactive && hover ? "var(--surface)" : "var(--bg-alt)",
      border: `1px solid ${interactive && hover ? "var(--border-strong)" : "var(--border)"}`,
      borderRadius: "var(--radius-md)",
      padding,
      cursor: interactive ? "pointer" : "default",
      transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Progress bar. Track --surface, fill --accent, with an inner white highlight.
 */
function ProgressBar({
  value = 0,
  max = 100,
  height = 12,
  showLabel = false,
  style,
  ...rest
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-valuenow": value,
    "aria-valuemax": max,
    style: {
      position: "relative",
      flex: 1,
      height,
      background: "var(--surface)",
      borderRadius: "var(--radius-pill)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: `${pct}%`,
      height: "100%",
      background: "var(--accent)",
      borderRadius: "var(--radius-pill)",
      transition: "width var(--dur-base) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 3,
      left: 8,
      right: 8,
      height: 4,
      borderRadius: "var(--radius-pill)",
      background: "rgba(255,255,255,0.32)"
    }
  }))), showLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 800,
      fontSize: "14px",
      fontVariantNumeric: "tabular-nums",
      color: "var(--text-muted)",
      minWidth: "3ch",
      textAlign: "right"
    }
  }, Math.round(pct), "%"));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Modal dialog. Warm-white surface, soft shadow (no glass/blur). Scrim behind.
 */
function Dialog({
  open = false,
  onClose,
  title,
  width = 440,
  style,
  children,
  footer,
  ...rest
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(55,53,47,0.30)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      zIndex: 1000
    }
  }, /*#__PURE__*/React.createElement("div", _extends({
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: width,
      background: "var(--bg)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-modal)",
      fontFamily: "var(--font-sans)",
      overflow: "hidden",
      ...style
    }
  }, rest), title && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px 0",
      fontSize: "20px",
      fontWeight: 700,
      color: "var(--text)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 24px",
      fontSize: "16px",
      lineHeight: 1.6,
      color: "var(--text-muted)"
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "12px",
      padding: "8px 24px 24px"
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Checkbox. Rounded square, leaf-green when checked.
 */
function Checkbox({
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  label,
  style,
  ...rest
}) {
  const [internal, setInternal] = React.useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;
  const toggle = e => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange?.(e);
  };
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      fontFamily: "var(--font-sans)",
      fontSize: "16px",
      color: "var(--text)",
      userSelect: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      flex: "0 0 auto",
      borderRadius: "6px",
      border: `2px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
      background: on ? "var(--accent)" : "var(--bg)",
      transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: on,
    disabled: disabled,
    onChange: toggle,
    style: {
      position: "absolute",
      opacity: 0,
      width: "100%",
      height: "100%",
      margin: 0,
      cursor: "inherit"
    }
  }, rest)), on && /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text input. Notion geometry: 1px border, radius 8. Focus = 2px accent ring.
 */
function Input({
  type = "text",
  value,
  defaultValue,
  placeholder,
  disabled = false,
  invalid = false,
  onChange,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const ringColor = invalid ? "var(--danger)" : "var(--accent)";
  return /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "16px",
      fontWeight: 400,
      color: "var(--text)",
      background: disabled ? "var(--surface)" : "var(--bg)",
      padding: "10px 14px",
      borderRadius: "var(--radius-sm)",
      border: `1px solid ${invalid ? "var(--danger)" : "var(--border)"}`,
      outline: focus ? `2px solid ${ringColor}` : "2px solid transparent",
      outlineOffset: "2px",
      width: "100%",
      boxSizing: "border-box",
      cursor: disabled ? "not-allowed" : "text",
      opacity: disabled ? 0.6 : 1,
      transition: "outline-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Radio button. Circle, leaf-green dot when selected.
 */
function Radio({
  checked,
  disabled = false,
  onChange,
  name,
  value,
  label,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      fontFamily: "var(--font-sans)",
      fontSize: "16px",
      color: "var(--text)",
      userSelect: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      flex: "0 0 auto",
      borderRadius: "50%",
      border: `2px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
      background: "var(--bg)",
      transition: "border-color var(--dur-fast) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "radio",
    name: name,
    value: value,
    checked: checked,
    disabled: disabled,
    onChange: onChange,
    style: {
      position: "absolute",
      opacity: 0,
      width: "100%",
      height: "100%",
      margin: 0,
      cursor: "inherit"
    }
  }, rest)), checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: "var(--accent)"
    }
  })), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Native-backed select with Notion border geometry.
 */
function Select({
  value,
  defaultValue,
  disabled = false,
  onChange,
  options = [],
  style,
  children,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "inline-block",
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    defaultValue: defaultValue,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: "none",
      WebkitAppearance: "none",
      fontFamily: "var(--font-sans)",
      fontSize: "16px",
      fontWeight: 400,
      color: "var(--text)",
      background: disabled ? "var(--surface)" : "var(--bg)",
      padding: "10px 40px 10px 14px",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--border)",
      outline: focus ? "2px solid var(--accent)" : "2px solid transparent",
      outlineOffset: "2px",
      width: "100%",
      boxSizing: "border-box",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      transition: "outline-color var(--dur-fast) var(--ease-out)",
      ...style
    }
  }, rest), children ?? options.map(o => {
    const val = typeof o === "string" ? o : o.value;
    const label = typeof o === "string" ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: val,
      value: val
    }, label);
  })), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      right: "14px",
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
      color: "var(--text-muted)",
      fontSize: "12px"
    }
  }, "\u25BE"));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Toggle switch. Track fills leaf-green when on.
 */
function Switch({
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  label,
  style,
  ...rest
}) {
  const [internal, setInternal] = React.useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;
  const toggle = e => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange?.(e);
  };
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "12px",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      fontFamily: "var(--font-sans)",
      fontSize: "16px",
      color: "var(--text)",
      userSelect: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      width: 44,
      height: 26,
      flex: "0 0 auto",
      borderRadius: "999px",
      background: on ? "var(--accent)" : "var(--border-strong)",
      transition: "background var(--dur-base) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: on,
    disabled: disabled,
    onChange: toggle,
    style: {
      position: "absolute",
      opacity: 0,
      width: "100%",
      height: "100%",
      margin: 0,
      cursor: "inherit"
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: on ? 21 : 3,
      width: 20,
      height: 20,
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      transition: "left var(--dur-base) var(--ease-tactile)"
    }
  })), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// ui_kits/learn/AppShell.jsx
try { (() => {
/* global React */
// Verdant Learn — app shell: 240px nav rail + top bar with streak/XP.

function NavItem({
  icon,
  label,
  active,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      padding: "10px 12px",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      fontWeight: 600,
      color: active ? "var(--text)" : "var(--text-muted)",
      background: active ? "var(--surface)" : hover ? "var(--bg-alt)" : "transparent",
      transition: "background 120ms"
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": icon,
    style: {
      width: 20,
      height: 20,
      color: active ? "var(--accent-deep)" : "currentColor"
    }
  }), label);
}
function AppShell({
  nav,
  screen,
  setScreen,
  children
}) {
  const {
    Badge,
    IconButton
  } = window.VerdantDesignSystem_a81bbe;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      minHeight: "100vh",
      background: "var(--bg)"
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 240,
      flex: "0 0 auto",
      borderRight: "1px solid var(--border)",
      padding: "20px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      position: "sticky",
      top: 0,
      height: "100vh",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "4px 12px 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: "var(--accent)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 3px 0 0 var(--accent-deep)"
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "sprout",
    style: {
      width: 17,
      height: 17,
      color: "#fff"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 700,
      fontSize: 18,
      color: "var(--text)"
    }
  }, "Verdant")), nav.map(n => /*#__PURE__*/React.createElement(NavItem, {
    key: n.id,
    icon: n.icon,
    label: n.label,
    active: screen === n.id,
    onClick: () => setScreen(n.id)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      padding: "12px",
      borderTop: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: "var(--xp)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: 700,
      fontSize: 14
    }
  }, "M"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text)"
    }
  }, "Maya"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 32px",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      background: "rgba(255,255,255,0.9)",
      backdropFilter: "blur(4px)",
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "streak"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "flame",
    style: {
      width: 15,
      height: 15
    }
  }), " 12"), /*#__PURE__*/React.createElement(Badge, {
    variant: "xp"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "zap",
    style: {
      width: 15,
      height: 15
    }
  }), " 1,240")), /*#__PURE__*/React.createElement(IconButton, {
    ariaLabel: "Settings"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "settings",
    style: {
      width: 20,
      height: 20
    }
  }))), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1
    }
  }, children)));
}
window.AppShell = AppShell;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/learn/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/learn/Dashboard.jsx
try { (() => {
/* global React */
// Dashboard — course path: lesson cards with progress. Duolingo practice cards live below.

function LessonRow({
  unit,
  title,
  meta,
  done,
  total,
  locked,
  onOpen
}) {
  const {
    Card,
    ProgressBar
  } = window.VerdantDesignSystem_a81bbe;
  return /*#__PURE__*/React.createElement(Card, {
    interactive: !locked,
    onClick: locked ? undefined : onOpen,
    style: {
      opacity: locked ? 0.55 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 12,
      flex: "0 0 auto",
      background: locked ? "var(--surface)" : done === total ? "var(--accent)" : "var(--accent-soft)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": locked ? "lock" : done === total ? "check" : "book-open",
    style: {
      width: 22,
      height: 22,
      color: locked ? "var(--text-dim)" : done === total ? "#fff" : "var(--accent-deep)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: "var(--text-dim)",
      textTransform: "uppercase",
      letterSpacing: "0.04em"
    }
  }, unit), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: "var(--text)",
      margin: "2px 0 10px"
    }
  }, title), !locked && /*#__PURE__*/React.createElement(ProgressBar, {
    value: done,
    max: total
  }), locked && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--text-muted)"
    }
  }, meta)), !locked && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--text-muted)",
      flex: "0 0 auto"
    }
  }, done, "/", total)));
}
function Dashboard({
  onOpenLesson,
  onPractice
}) {
  const {
    Card,
    Button,
    ProgressBar
  } = window.VerdantDesignSystem_a81bbe;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "40px 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 24,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--text-h1)",
      color: "var(--text)",
      margin: 0
    }
  }, "Good morning, Maya"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      color: "var(--text-muted)",
      margin: "8px 0 0"
    }
  }, "You're on a 12-day streak. Keep it going.")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onPractice
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "dumbbell",
    style: {
      width: 18,
      height: 18
    }
  }), " Daily practice")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gap: 32,
      marginTop: 32,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: "var(--text-dim)",
      textTransform: "uppercase",
      letterSpacing: "0.04em"
    }
  }, "Spanish \xB7 Course path"), /*#__PURE__*/React.createElement(LessonRow, {
    unit: "Unit 1",
    title: "Greetings & introductions",
    done: 6,
    total: 6,
    onOpen: onOpenLesson
  }), /*#__PURE__*/React.createElement(LessonRow, {
    unit: "Unit 2",
    title: "Everyday phrases",
    done: 5,
    total: 8,
    onOpen: onOpenLesson
  }), /*#__PURE__*/React.createElement(LessonRow, {
    unit: "Unit 3",
    title: "Verbs in the present",
    done: 2,
    total: 12,
    onOpen: onOpenLesson
  }), /*#__PURE__*/React.createElement(LessonRow, {
    unit: "Unit 4",
    title: "Talking about the past",
    meta: "Complete Unit 3 to unlock",
    done: 0,
    total: 10,
    locked: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: "var(--text-dim)",
      textTransform: "uppercase",
      letterSpacing: "0.04em"
    }
  }, "This week"), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 800,
      color: "var(--streak)",
      fontVariantNumeric: "tabular-nums",
      lineHeight: 1
    }
  }, "12"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)",
      marginTop: 4
    }
  }, "day streak")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 800,
      color: "var(--xp)",
      fontVariantNumeric: "tabular-nums",
      lineHeight: 1
    }
  }, "340"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)",
      marginTop: 4
    }
  }, "XP this week"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, ["M", "T", "W", "T", "F", "S", "S"].map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 28,
      borderRadius: 8,
      marginBottom: 4,
      background: i < 5 ? "var(--accent)" : "var(--surface)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, i < 5 && /*#__PURE__*/React.createElement("i", {
    "data-lucide": "check",
    style: {
      width: 14,
      height: 14,
      color: "#fff"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: "var(--text-dim)"
    }
  }, d))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "target",
    style: {
      width: 18,
      height: 18,
      color: "var(--accent-deep)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: "var(--text)"
    }
  }, "Daily goal")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: "var(--text-muted)",
      margin: "0 0 12px"
    }
  }, "20 XP \xB7 almost there"), /*#__PURE__*/React.createElement(ProgressBar, {
    value: 15,
    max: 20,
    showLabel: true
  })))));
}
window.Dashboard = Dashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/learn/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/learn/Lesson.jsx
try { (() => {
/* global React */
// Lesson — Notion reading document (720px column) with callouts, then a CTA to practice.

function Lesson({
  onBack,
  onPractice
}) {
  const {
    Callout,
    Button,
    Badge
  } = window.VerdantDesignSystem_a81bbe;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto",
      padding: "32px 24px 80px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: "none",
      background: "none",
      cursor: "pointer",
      color: "var(--text-muted)",
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 600,
      padding: 0,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "arrow-left",
    style: {
      width: 16,
      height: 16
    }
  }), " Back to path"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "accent"
  }, "Unit 3"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: "var(--text-muted)"
    }
  }, "Lesson 3 of 12")), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--text-h1)",
      color: "var(--text)",
      margin: "0 0 20px"
    }
  }, "Present-tense verbs"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      lineHeight: 1.6,
      color: "var(--text)",
      margin: "0 0 20px"
    }
  }, "In Spanish, verbs change their ending to match who is doing the action. Regular verbs fall into three families based on their infinitive ending: ", /*#__PURE__*/React.createElement("strong", null, "-ar"), ", ", /*#__PURE__*/React.createElement("strong", null, "-er"), ", and", /*#__PURE__*/React.createElement("strong", null, " -ir"), ". Once you learn the pattern for each family, you can conjugate hundreds of verbs."), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: "var(--text-h3)",
      color: "var(--text)",
      margin: "32px 0 12px"
    }
  }, "The -ar family"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      lineHeight: 1.6,
      color: "var(--text)",
      margin: "0 0 20px"
    }
  }, "Take ", /*#__PURE__*/React.createElement("em", null, "hablar"), " (to speak). Drop the ", /*#__PURE__*/React.createElement("strong", null, "-ar"), " and add the ending for each person. The stem ", /*#__PURE__*/React.createElement("em", null, "habl-"), " stays the same throughout."), /*#__PURE__*/React.createElement(Callout, {
    tone: "accent",
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "lightbulb",
      style: {
        width: 18,
        height: 18
      }
    }),
    title: "Pattern to remember"
  }, "Every regular ", /*#__PURE__*/React.createElement("strong", null, "-ar"), " verb uses the same endings: ", /*#__PURE__*/React.createElement("em", null, "-o, -as, -a, -amos, -\xE1is, -an"), "."), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 20
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-alt)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
      margin: "8px 0 24px"
    }
  }, [["yo", "hablo"], ["tú", "hablas"], ["él / ella", "habla"], ["nosotros", "hablamos"]].map(([a, b], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      justifyContent: "space-between",
      padding: "12px 18px",
      borderTop: i ? "1px solid var(--border)" : "none",
      fontSize: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-muted)"
    }
  }, a), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text)",
      fontWeight: 600
    }
  }, b)))), /*#__PURE__*/React.createElement(Callout, {
    tone: "streak",
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "flame",
      style: {
        width: 18,
        height: 18
      }
    }),
    title: "Keep your streak"
  }, "Finish the practice below to earn 20 XP and extend your streak to 13 days."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginTop: 36
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: onPractice
  }, "Start practice ", /*#__PURE__*/React.createElement("i", {
    "data-lucide": "arrow-right",
    style: {
      width: 18,
      height: 18
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    onClick: onBack
  }, "Mark as read")));
}
window.Lesson = Lesson;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/learn/Lesson.jsx", error: String((e && e.message) || e) }); }

// ui_kits/learn/Practice.jsx
try { (() => {
/* global React */
// Practice — Duolingo exercise: 480px card stack, tactile answer tiles, check + feedback.

const QUESTIONS = [{
  prompt: "Choose the correct translation",
  subject: "I speak Spanish",
  answer: 1,
  options: ["Yo hablas español", "Yo hablo español", "Yo habla español", "Yo hablan español"]
}, {
  prompt: "Complete the sentence",
  subject: "Nosotros ___ en casa",
  answer: 2,
  options: ["hablo", "hablas", "hablamos", "hablan"]
}];
function AnswerTile({
  label,
  state,
  onClick
}) {
  // state: idle | selected | correct | wrong
  const styles = {
    idle: {
      border: "2px solid var(--border-strong)",
      bg: "var(--bg)",
      shadow: "0 4px 0 0 var(--border-strong)",
      color: "var(--text)"
    },
    selected: {
      border: "2px solid var(--xp)",
      bg: "#e8f6ff",
      shadow: "0 4px 0 0 #7cc7ef",
      color: "var(--text)"
    },
    correct: {
      border: "2px solid var(--accent)",
      bg: "var(--accent-soft)",
      shadow: "0 4px 0 0 var(--accent-deep)",
      color: "var(--accent-deep)"
    },
    wrong: {
      border: "2px solid var(--danger)",
      bg: "#ffecec",
      shadow: "0 4px 0 0 #d63030",
      color: "var(--danger)"
    }
  }[state];
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    style: {
      display: "flex",
      alignItems: "center",
      width: "100%",
      textAlign: "left",
      padding: "16px 18px",
      borderRadius: 16,
      cursor: "pointer",
      border: styles.border,
      background: styles.bg,
      color: styles.color,
      fontFamily: "var(--font-sans)",
      fontSize: 16,
      fontWeight: 600,
      boxShadow: pressed ? "0 0 0 0 transparent" : styles.shadow,
      transform: pressed ? "translateY(2px)" : "none",
      transition: "transform 100ms, box-shadow 100ms"
    }
  }, label);
}
function Practice({
  onExit
}) {
  const {
    Button,
    ProgressBar
  } = window.VerdantDesignSystem_a81bbe;
  const [qi, setQi] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [checked, setChecked] = React.useState(false);
  const q = QUESTIONS[qi];
  const correct = sel === q.answer;
  const isLast = qi === QUESTIONS.length - 1;
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [qi, sel, checked]);
  const tileState = i => {
    if (!checked) return sel === i ? "selected" : "idle";
    if (i === q.answer) return "correct";
    if (i === sel) return "wrong";
    return "idle";
  };
  const next = () => {
    if (isLast) {
      onExit();
      return;
    }
    setQi(qi + 1);
    setSel(null);
    setChecked(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "calc(100vh - 65px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "var(--bg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 600,
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "24px 24px 0"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    "aria-label": "Exit",
    style: {
      border: "none",
      background: "none",
      cursor: "pointer",
      color: "var(--text-dim)",
      display: "flex",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "x",
    style: {
      width: 24,
      height: 24
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    value: qi + (checked ? 1 : 0),
    max: QUESTIONS.length
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      width: "100%",
      maxWidth: 480,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "24px",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text-dim)",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      marginBottom: 10
    }
  }, q.prompt), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-h2)",
      color: "var(--text)"
    }
  }, q.subject)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, q.options.map((opt, i) => /*#__PURE__*/React.createElement(AnswerTile, {
    key: i,
    label: opt,
    state: tileState(i),
    onClick: () => !checked && setSel(i)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      borderTop: `1px solid ${checked ? correct ? "#cdeeae" : "#ffc9c9" : "var(--border)"}`,
      background: checked ? correct ? "var(--accent-soft)" : "#ffecec" : "var(--bg)",
      transition: "background 150ms"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 480,
      margin: "0 auto",
      padding: "20px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16
    }
  }, checked ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      color: correct ? "var(--accent-deep)" : "var(--danger)",
      fontWeight: 700,
      fontSize: 16
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": correct ? "check-circle" : "x-circle",
    style: {
      width: 22,
      height: 22
    }
  }), correct ? "Nice! +10 XP" : "Correct: " + q.options[q.answer]) : /*#__PURE__*/React.createElement("span", null), checked ? /*#__PURE__*/React.createElement(Button, {
    variant: correct ? "primary" : "danger",
    onClick: next
  }, isLast ? "Finish" : "Continue") : /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    disabled: sel === null,
    onClick: () => setChecked(true)
  }, "Check"))));
}
window.Practice = Practice;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/learn/Practice.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

})();
