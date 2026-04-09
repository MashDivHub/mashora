/**
 * Evaluates Python-like expressions used in Mashora 19+ view attributes.
 * Examples: "state != 'draft'", "amount > 0 and state == 'posted'", "not is_company"
 */

type TokenType = 'STRING' | 'NUMBER' | 'BOOL' | 'NAME' | 'OP' | 'COMPARE' | 'LOGIC' | 'NOT' | 'IN' | 'LPAREN' | 'RPAREN'

interface Token { type: TokenType; value: any }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue }
    // String literals
    if (expr[i] === "'" || expr[i] === '"') {
      const quote = expr[i]; i++
      let str = ''
      while (i < expr.length && expr[i] !== quote) { str += expr[i]; i++ }
      i++ // skip closing quote
      tokens.push({ type: 'STRING', value: str })
      continue
    }
    // Numbers
    if (/\d/.test(expr[i]) || (expr[i] === '-' && i + 1 < expr.length && /\d/.test(expr[i+1]))) {
      let num = ''
      if (expr[i] === '-') { num = '-'; i++ }
      while (i < expr.length && /[\d.]/.test(expr[i])) { num += expr[i]; i++ }
      tokens.push({ type: 'NUMBER', value: parseFloat(num) })
      continue
    }
    // Comparison operators
    if (expr.substring(i, i+2) === '!=' || expr.substring(i, i+2) === '==' ||
        expr.substring(i, i+2) === '<=' || expr.substring(i, i+2) === '>=') {
      tokens.push({ type: 'COMPARE', value: expr.substring(i, i+2) }); i += 2; continue
    }
    if (expr[i] === '<' || expr[i] === '>') {
      tokens.push({ type: 'COMPARE', value: expr[i] }); i++; continue
    }
    if (expr[i] === '=' && (i+1 >= expr.length || expr[i+1] !== '=')) {
      tokens.push({ type: 'COMPARE', value: '==' }); i++; continue
    }
    // Comma (for tuples)
    if (expr[i] === ',') { tokens.push({ type: 'OP', value: ',' }); i++; continue }
    // Parentheses
    if (expr[i] === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue }
    if (expr[i] === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue }
    // Brackets (for lists)
    if (expr[i] === '[') { tokens.push({ type: 'LPAREN', value: '[' }); i++; continue }
    if (expr[i] === ']') { tokens.push({ type: 'RPAREN', value: ']' }); i++; continue }
    // Words (identifiers, keywords)
    if (/[a-zA-Z_]/.test(expr[i])) {
      let word = ''
      while (i < expr.length && /[a-zA-Z0-9_.]/.test(expr[i])) { word += expr[i]; i++ }
      if (word === 'and') tokens.push({ type: 'LOGIC', value: 'and' })
      else if (word === 'or') tokens.push({ type: 'LOGIC', value: 'or' })
      else if (word === 'not') tokens.push({ type: 'NOT', value: 'not' })
      else if (word === 'in') tokens.push({ type: 'IN', value: 'in' })
      else if (word === 'True') tokens.push({ type: 'BOOL', value: true })
      else if (word === 'False') tokens.push({ type: 'BOOL', value: false })
      else if (word === 'None') tokens.push({ type: 'BOOL', value: null })
      else tokens.push({ type: 'NAME', value: word })
      continue
    }
    i++ // skip unknown
  }
  return tokens
}

/**
 * Python-like equality: False == 0 == '' in Mashora context.
 * In Python: False == 0 is True, but False == '' is False.
 * For Mashora views we need: falsy values match each other for practical purposes.
 */
function pyEq(a: any, b: any): boolean {
  if (a === b) return true
  // null/undefined/false/None equivalence
  if ((a === null || a === undefined || a === false) && (b === null || b === undefined || b === false)) return true
  // Python: False == 0 is True, 0 == False is True
  if ((a === false || a === 0 || a === null || a === undefined) && (b === false || b === 0 || b === null || b === undefined)) return true
  // Empty string == False/None in Mashora view context
  if (a === '' && (b === false || b === null || b === undefined)) return true
  if (b === '' && (a === false || a === null || a === undefined)) return true
  return false
}

export function evaluateExpression(expr: string, values: Record<string, any>): boolean {
  if (!expr || expr.trim() === '') return false
  // Handle old-style domain format: [('field', '=', value)]
  if (expr.trim().startsWith('[')) {
    try {
      // Try parsing as JSON-ish domain
      return false // Legacy domains should be handled by domain.ts
    } catch { return false }
  }

  try {
    const tokens = tokenize(expr)
    let pos = 0

    function getValue(): any {
      const t = tokens[pos]
      if (!t) return undefined
      if (t.type === 'STRING' || t.type === 'NUMBER' || t.type === 'BOOL') { pos++; return t.value }
      if (t.type === 'NAME') { pos++; return values[t.value] }
      if (t.type === 'NOT') { pos++; return !getValue() }
      if (t.type === 'LPAREN') {
        const bracket = t.value // '(' or '['
        pos++ // skip ( or [
        // Check if this is a tuple/list (has commas) or just grouping parens
        if (tokens[pos]?.type === 'RPAREN') {
          pos++ // empty tuple/list
          return []
        }
        const items: any[] = [parseOr()]
        let hasComma = false
        while (pos < tokens.length && tokens[pos]?.type === 'OP' && tokens[pos]?.value === ',') {
          hasComma = true
          pos++ // skip comma
          if (tokens[pos]?.type === 'RPAREN') break // trailing comma
          items.push(parseOr())
        }
        if (tokens[pos]?.type === 'RPAREN') pos++ // skip ) or ]
        // [] always returns array; () returns array only if commas present (tuple), else unwrap (grouping)
        if (bracket === '[' || hasComma) return items
        return items[0]
      }
      pos++
      return undefined
    }

    function parseComparison(): any {
      let left = getValue()
      while (pos < tokens.length) {
        const t = tokens[pos]
        if (t?.type === 'COMPARE') {
          pos++
          const right = getValue()
          switch (t.value) {
            case '==': left = pyEq(left, right); break
            case '!=': left = left !== right; break
            case '<': left = left < right; break
            case '>': left = left > right; break
            case '<=': left = left <= right; break
            case '>=': left = left >= right; break
          }
        } else if (t?.type === 'IN') {
          pos++
          const right = getValue()
          left = Array.isArray(right) ? right.includes(left) : false
        } else if (t?.type === 'NOT' && tokens[pos+1]?.type === 'IN') {
          pos += 2
          const right = getValue()
          left = Array.isArray(right) ? !right.includes(left) : true
        } else {
          break
        }
      }
      return left
    }

    function parseAnd(): any {
      let left = parseComparison()
      while (pos < tokens.length && tokens[pos]?.type === 'LOGIC' && tokens[pos]?.value === 'and') {
        pos++
        const right = parseComparison()
        left = left && right
      }
      return left
    }

    function parseOr(): any {
      let left = parseAnd()
      while (pos < tokens.length && tokens[pos]?.type === 'LOGIC' && tokens[pos]?.value === 'or') {
        pos++
        const right = parseAnd()
        left = left || right
      }
      return left
    }

    const result = parseOr()
    return Boolean(result)
  } catch {
    return false
  }
}
