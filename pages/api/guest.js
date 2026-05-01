import guests from '../../data/guests.json'

export default function handler(req, res) {
  const { code } = req.query
  const guest = guests[code]
  if (guest) {
    res.status(200).json(guest)
  } else {
    res.status(404).json({ error: 'Not found' })
  }
}
