import { spawn } from 'child_process'
import path from 'path'

interface FarmerReportPdfPayload {
  farmId: number
  startDateFrom: string
  startDateTo: string
  productId?: number | null
  outputPath?: string
}

const FARMER_PDF_SCRIPT = path.resolve(__dirname, '..', '..', 'reports', 'farmer_report_pdf.py')
const FARMER_ORDER_PDF_SCRIPT = path.resolve(__dirname, '..', '..', 'reports', 'farmer_orders_report_pdf.py')
const ADMIN_LOYALTY_PDF_SCRIPT = path.resolve(__dirname, '..', '..', 'reports', 'admin_loyalty_report_pdf.py')
const ADMIN_PRODUCTIVITY_PDF_SCRIPT = path.resolve(__dirname, '..', '..', 'reports', 'admin_productivity_report_pdf.py')
const ADMIN_PRODUCT_SALES_PDF_SCRIPT = path.resolve(__dirname, '..', '..', 'reports', 'admin_product_sales_report_pdf.py')

function spawnPythonScript(scriptPath: string, args: string[], input?: string): Promise<string> {
  const pythonBinary = process.env.PYTHON_BIN || 'python3'
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBinary, [scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      reject(error)
    })
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Report generator failed with code ${code}. ${stderr || ''}`.trim()))
        return
      }
      resolve(stdout)
    })
    if (input) {
      child.stdin.write(input)
    }
    child.stdin.end()
  })
}

export async function runFarmerReportPdf(payload: FarmerReportPdfPayload): Promise<{ filePath: string; publicUrl: string }> {
  const args: string[] = [
    '--farm-id',
    payload.farmId.toString(),
    '--from',
    payload.startDateFrom,
    '--to',
    payload.startDateTo
  ]
  if (payload.productId) {
    args.push('--product-id', payload.productId.toString())
  }
  if (payload.outputPath) {
    args.push('--output', payload.outputPath)
  }
  const stdout = await spawnPythonScript(FARMER_PDF_SCRIPT, args)
  try {
    const output = stdout ? JSON.parse(stdout) : {}
    if (!output.publicUrl || !output.path) {
      throw new Error('Report generator did not return file metadata.')
    }
    return {
      filePath: String(output.path),
      publicUrl: String(output.publicUrl)
    }
  } catch (error) {
    throw new Error(`Unable to parse PDF report output. ${(error as Error).message}`)
  }
}

export async function runFarmerOrderSalesReportPdf(payload: { farmId: number; startDateFrom: string; startDateTo: string; outputPath?: string }): Promise<{ filePath: string; publicUrl: string }> {
  const args: string[] = [
    '--farm-id',
    payload.farmId.toString(),
    '--from',
    payload.startDateFrom,
    '--to',
    payload.startDateTo
  ]
  if (payload.outputPath) {
    args.push('--output', payload.outputPath)
  }
  const stdout = await spawnPythonScript(FARMER_ORDER_PDF_SCRIPT, args)
  try {
    const output = stdout ? JSON.parse(stdout) : {}
    if (!output.publicUrl || !output.path) {
      throw new Error('Report generator did not return file metadata.')
    }
    return {
      filePath: String(output.path),
      publicUrl: String(output.publicUrl)
    }
  } catch (error) {
    throw new Error(`Unable to parse order report output. ${(error as Error).message}`)
  }
}

export async function runAdminLoyaltyReportPdf(payload: { startDateFrom: string; startDateTo: string; outputPath?: string }): Promise<{ filePath: string; publicUrl: string }> {
  const args = ['--from', payload.startDateFrom, '--to', payload.startDateTo]
  if (payload.outputPath) {
    args.push('--output', payload.outputPath)
  }
  const stdout = await spawnPythonScript(ADMIN_LOYALTY_PDF_SCRIPT, args)
  try {
    const output = stdout ? JSON.parse(stdout) : {}
    if (!output.publicUrl || !output.path) {
      throw new Error('Report generator did not return file metadata.')
    }
    return {
      filePath: String(output.path),
      publicUrl: String(output.publicUrl)
    }
  } catch (error) {
    throw new Error(`Unable to parse admin loyalty report output. ${(error as Error).message}`)
  }
}

export async function runAdminProductivityReportPdf(payload: { startDateFrom: string; startDateTo: string; outputPath?: string }): Promise<{ filePath: string; publicUrl: string }> {
  const args = ['--from', payload.startDateFrom, '--to', payload.startDateTo]
  if (payload.outputPath) {
    args.push('--output', payload.outputPath)
  }
  const stdout = await spawnPythonScript(ADMIN_PRODUCTIVITY_PDF_SCRIPT, args)
  try {
    const output = stdout ? JSON.parse(stdout) : {}
    if (!output.publicUrl || !output.path) {
      throw new Error('Report generator did not return file metadata.')
    }
    return {
      filePath: String(output.path),
      publicUrl: String(output.publicUrl)
    }
  } catch (error) {
    throw new Error(`Unable to parse admin productivity report output. ${(error as Error).message}`)
  }
}

export async function runAdminProductSalesReportPdf(payload: { startDateFrom: string; startDateTo: string; outputPath?: string }): Promise<{ filePath: string; publicUrl: string }> {
  const args = ['--from', payload.startDateFrom, '--to', payload.startDateTo]
  if (payload.outputPath) {
    args.push('--output', payload.outputPath)
  }
  const stdout = await spawnPythonScript(ADMIN_PRODUCT_SALES_PDF_SCRIPT, args)
  try {
    const output = stdout ? JSON.parse(stdout) : {}
    if (!output.publicUrl || !output.path) {
      throw new Error('Report generator did not return file metadata.')
    }
    return {
      filePath: String(output.path),
      publicUrl: String(output.publicUrl)
    }
  } catch (error) {
    throw new Error(`Unable to parse admin product sales report output. ${(error as Error).message}`)
  }
}
