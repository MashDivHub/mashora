// Domain types
export type DomainOperator = '&' | '|' | '!'
export type ComparisonOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like' | 'not like' | 'ilike' | 'not ilike' | 'in' | 'not in' | '=like' | '=ilike' | 'child_of' | 'parent_of'
export type DomainLeaf = [string, ComparisonOperator, any]
export type DomainElement = DomainOperator | DomainLeaf
export type Domain = DomainElement[]

export function combineDomains(domains: Domain[]): Domain {
  // Combine multiple domains with AND
  const nonEmpty = domains.filter(d => d.length > 0)
  if (nonEmpty.length === 0) return []
  if (nonEmpty.length === 1) return nonEmpty[0]
  // Add '&' operators: for N domains, we need N-1 '&' operators
  const result: Domain = []
  for (let i = 0; i < nonEmpty.length - 1; i++) result.push('&')
  for (const d of nonEmpty) result.push(...d)
  return result
}

export function evaluateDomainLeaf(leaf: DomainLeaf, record: Record<string, any>): boolean {
  const [field, op, value] = leaf
  const fieldValue = record[field]
  switch (op) {
    case '=': return fieldValue === value || (fieldValue === false && value === false)
    case '!=': return fieldValue !== value
    case '<': return fieldValue < value
    case '>': return fieldValue > value
    case '<=': return fieldValue <= value
    case '>=': return fieldValue >= value
    case 'in': return Array.isArray(value) && value.includes(fieldValue)
    case 'not in': return !Array.isArray(value) || !value.includes(fieldValue)
    case 'like': case 'ilike': return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(String(value).toLowerCase())
    case 'not like': case 'not ilike': return typeof fieldValue !== 'string' || !fieldValue.toLowerCase().includes(String(value).toLowerCase())
    default: return true
  }
}

export function evaluateDomain(domain: Domain, record: Record<string, any>): boolean {
  if (!domain || domain.length === 0) return true
  // Stack-based Polish notation evaluator
  const stack: boolean[] = []
  // Process in reverse order (Polish notation)
  for (let i = domain.length - 1; i >= 0; i--) {
    const el = domain[i]
    if (Array.isArray(el)) {
      stack.push(evaluateDomainLeaf(el as DomainLeaf, record))
    } else if (el === '&') {
      const a = stack.pop() ?? true
      const b = stack.pop() ?? true
      stack.push(a && b)
    } else if (el === '|') {
      const a = stack.pop() ?? false
      const b = stack.pop() ?? false
      stack.push(a || b)
    } else if (el === '!') {
      const a = stack.pop() ?? true
      stack.push(!a)
    }
  }
  return stack.pop() ?? true
}

export function domainToReadable(domain: Domain): string {
  // Simple human-readable conversion
  return domain.filter(Array.isArray).map((leaf) => {
    const l = leaf as [unknown, unknown, unknown]
    return `${String(l[0])} ${String(l[1])} ${JSON.stringify(l[2])}`
  }).join(' AND ')
}
