import { Flex, FlexProps } from '@chakra-ui/react'

import { KeepKeyUILogo } from './keepkey-ui'

export const Logo = (props: FlexProps & { logo?: React.ReactNode }) => {
  const { logo } = props
  return (
    <Flex width="160px" {...props}>
      {logo || <KeepKeyUILogo />}
    </Flex>
  )
}
