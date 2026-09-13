import ApplicationServices
import Foundation

func attr(_ element: AXUIElement, _ name: CFString) -> AnyObject? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, name, &value) == .success ? value as AnyObject? : nil
}

func stringAttr(_ element: AXUIElement, _ name: CFString) -> String {
    return attr(element, name) as? String ?? ""
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    return attr(element, kAXChildrenAttribute as CFString) as? [AXUIElement] ?? []
}

guard CommandLine.arguments.count >= 4,
      let pid = Int32(CommandLine.arguments[1]) else {
    fputs("usage: kk-qa-ax PID WINDOW-TITLE BUTTON-TITLE [press|list]\n", stderr)
    exit(2)
}
let windowTitle = CommandLine.arguments[2]
let buttonTitle = CommandLine.arguments[3]
let action = CommandLine.arguments.count >= 5 ? CommandLine.arguments[4] : "list"
let app = AXUIElementCreateApplication(pid)
let windows = children(app).filter { stringAttr($0, kAXTitleAttribute as CFString) == windowTitle }
guard windows.count == 1 else {
    fputs("expected one window named \(windowTitle), found \(windows.count)\n", stderr)
    exit(1)
}
var matches: [AXUIElement] = []
var buttons: [String] = []
var texts: [String] = []
func walk(_ element: AXUIElement, _ depth: Int) {
    if depth > 25 { return }
    let role = stringAttr(element, kAXRoleAttribute as CFString)
    let title = stringAttr(element, kAXTitleAttribute as CFString)
    let description = stringAttr(element, kAXDescriptionAttribute as CFString)
    if role == "AXButton" { buttons.append("title=\(title) description=\(description)") }
    if role == "AXStaticText" {
        let value = stringAttr(element, kAXValueAttribute as CFString)
        texts.append(value.isEmpty ? title : value)
    }
    if role == "AXButton" && (title == buttonTitle || description == buttonTitle) {
        matches.append(element)
    }
    for child in children(element) { walk(child, depth + 1) }
}
walk(windows[0], 0)
if action == "dump" {
    for button in buttons { print(button) }
    exit(0)
}
if action == "dumptext" {
    for value in texts { print(value) }
    exit(0)
}
print("matches=\(matches.count) window=\(windowTitle) button=\(buttonTitle)")
guard matches.count == 1 else { exit(1) }
print("enabled=\(String(describing: attr(matches[0], kAXEnabledAttribute as CFString)))")
if action == "mouse" {
    guard let positionValue = attr(matches[0], kAXPositionAttribute as CFString),
          let sizeValue = attr(matches[0], kAXSizeAttribute as CFString) else { exit(1) }
    var position = CGPoint.zero
    var size = CGSize.zero
    guard AXValueGetValue(positionValue as! AXValue, .cgPoint, &position),
          AXValueGetValue(sizeValue as! AXValue, .cgSize, &size) else { exit(1) }
    let center = CGPoint(x: position.x + size.width / 2, y: position.y + size.height / 2)
    print("mouseCenter=\(center)")
    let source = CGEventSource(stateID: .hidSystemState)
    CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: center, mouseButton: .left)?.post(tap: .cghidEventTap)
    CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: center, mouseButton: .left)?.post(tap: .cghidEventTap)
    exit(0)
}
if action == "press" {
    let result = AXUIElementPerformAction(matches[0], kAXPressAction as CFString)
    print("press=\(result.rawValue)")
    if result != .success { exit(1) }
}
