import { HeapEnum } from './enums.js'
import type { Comparator } from './types.js'

export class Heap<T> {
  private heap: T[] = []

  constructor(
    private comparator: Comparator<T>,
    private type: HeapEnum = HeapEnum.MIN
  ) {}

  private compare(a: T, b: T): number {
    return this.type === HeapEnum.MIN ? this.comparator(a, b) : this.comparator(b, a)
  }

  private parent(index: number) {
    return Math.floor((index - 1) / 2)
  }

  private leftChild(index: number) {
    return 2 * index + 1
  }

  private rightChild(index: number) {
    return 2 * index + 2
  }

  private swap(i: number, j: number) {
    ;[this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]]
  }

  private heapInsert(index: number) {
    while (index > 0 && this.compare(this.heap[index], this.heap[this.parent(index)]) < 0) {
      this.swap(index, this.parent(index))
      index = this.parent(index)
    }
  }

  private heapRemove(index: number) {
    let best = index
    const left = this.leftChild(index)
    const right = this.rightChild(index)

    if (left < this.heap.length && this.compare(this.heap[left], this.heap[best]) < 0) {
      best = left
    }

    if (right < this.heap.length && this.compare(this.heap[right], this.heap[best]) < 0) {
      best = right
    }

    if (best !== index) {
      this.swap(index, best)
      this.heapRemove(best)
    }
  }

  insert(value: T) {
    this.heap.push(value)
    this.heapInsert(this.heap.length - 1)
  }

  extract(): T | undefined {
    if (this.heap.length === 0) return undefined

    const top = this.heap[0]
    const last = this.heap.pop()

    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last
      this.heapRemove(0)
    }

    return top
  }

  peek(): T | undefined {
    return this.heap[0]
  }

  size(): number {
    return this.heap.length
  }

  isEmpty(): boolean {
    return this.heap.length === 0
  }

  toArray(): T[] {
    return [...this.heap]
  }
}
