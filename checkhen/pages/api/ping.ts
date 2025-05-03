import type { NextApiRequest, NextApiResponse } from 'next'

// Define the structure of the response data
type ResponseData = {
  message: string
}

// API handler function to respond to requests
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Respond with a 200 status and a "Pong!" message
  res.status(200).json({ message: 'Pong!' })
}