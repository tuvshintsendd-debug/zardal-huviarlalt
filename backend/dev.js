import { spawn } from 'node:child_process'

const children = [
  spawn(process.execPath, ['backend/server.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit' }),
]

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  children.forEach((child) => {
    if (child.exitCode === null) child.kill()
  })
  process.exitCode = code
}

children.forEach((child) => {
  child.on('error', () => stop(1))
  child.on('exit', (code) => stop(code ?? 1))
})

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))