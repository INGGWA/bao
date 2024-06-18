import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from 'src/open-ai/open-ai.service';
import { CreateChatDto } from './dto/create-gangsan.dto';
import { ScrapperService } from 'src/scrapper/scrapper.service';

@Injectable()
export class GangsanService {
  private assistant: OpenAI.Beta.Assistant;
  constructor(
    private configService: ConfigService,
    private openAIService: OpenAIService,
    private scrapperService: ScrapperService,
  ) {
    (async () => {
      // ... All async code here
      this.assistant = await this.openAIService.openAI.beta.assistants.retrieve(
        this.configService.get('GANGSAN_ASST_ID'),
      );
    })();
  }
  async createChat(createChatDto: CreateChatDto) {
    if (createChatDto.msg.includes('공지사항')) {
      const boardLists = await this.scrapperService.scrapeBoardLists();
      // 1. [카테고리]제목, 링크 형태로 반환
      return {
        msg: boardLists
          .map(
            (board, idx) =>
              `${idx + 1}. ${board.category}${board.title}, ${board.link}`,
          )
          .join('\n\n'),
      };
    }
    // create message
    await this.openAIService.openAI.beta.threads.messages.create(
      this.configService.get('THREAD_ID'),
      {
        role: 'user',
        content: createChatDto.msg,
      },
    );
    // Run the assistant
    const run = await this.openAIService.openAI.beta.threads.runs.createAndPoll(
      this.configService.get('THREAD_ID'),
      {
        assistant_id: this.assistant.id,
        instructions: `address the user as ${createChatDto.name}`,
      },
    );
    if (run.status === 'completed') {
      const messages =
        await this.openAIService.openAI.beta.threads.messages.list(
          run.thread_id,
        );
      for (const message of messages.data.reverse()) {
        console.log(
          `${message.role} > ${this.extractMessageContent(message.content)}`,
        );
      }
      return {
        msg: `${createChatDto.name}님 안녕하세요! ${this.extractMessageContent(
          messages.data[messages.data.length - 1].content,
        )}`,
      };
    } else {
      console.log(run.status);
    }
  }
  private extractMessageContent(content: any): string {
    return content
      .map((block) => {
        if (block.type === 'text' && block.text) {
          return block.text.value;
        }
        // Add other content block type handlers if needed
        return '';
      })
      .join(' ');
  }
}
