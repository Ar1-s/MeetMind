'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

interface Field {
  name: string
  label: string
  type: string
  required: boolean
}

interface CreateMeetingFormProps {
  fields: Field[]
  prefill?: Record<string, string>
  onSubmit: (data: Record<string, string>) => void
  onCancel: () => void
}

export default function CreateMeetingForm({
  fields,
  prefill = {},
  onSubmit,
  onCancel,
}: CreateMeetingFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>(prefill)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}

    fields.forEach(field => {
      if (field.required && !formData[field.name]?.trim()) {
        newErrors[field.name] = `${field.label}是必填项`
      }
    })

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSubmit(formData)
  }

  return (
    <Paper sx={{ p: 2, mt: 1, maxWidth: 400 }}>
      <Typography variant="subtitle1" fontWeight="bold" mb={2}>
        创建新会议
      </Typography>

      <Box display="flex" flexDirection="column" gap={2}>
        {fields.map(field => (
          <TextField
            key={field.name}
            label={field.label}
            type={field.type === 'datetime' ? 'datetime-local' : 'text'}
            value={formData[field.name] || ''}
            onChange={e => handleChange(field.name, e.target.value)}
            error={!!errors[field.name]}
            helperText={errors[field.name]}
            required={field.required}
            size="small"
            fullWidth
            InputLabelProps={field.type === 'datetime' ? { shrink: true } : undefined}
          />
        ))}

        <Box display="flex" gap={1} justifyContent="flex-end">
          <Button variant="outlined" size="small" onClick={onCancel}>
            取消
          </Button>
          <Button variant="contained" size="small" onClick={handleSubmit}>
            创建
          </Button>
        </Box>
      </Box>
    </Paper>
  )
}
