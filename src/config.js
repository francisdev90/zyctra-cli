import Conf from 'conf'

export const config = new Conf({
  projectName: 'zyctra',
  schema: {
    token:     { type: 'string' },
    email:     { type: 'string' },
    engine:    { type: 'string', default: 'zev' },
    plan:      { type: 'string', default: 'free' },
    userId:    { type: 'string' },
    isFounder: { type: 'boolean', default: false },
  },
})
